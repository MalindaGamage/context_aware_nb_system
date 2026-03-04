import os
import re
from datetime import datetime, time, timezone
from typing import Any

import psycopg
from fastapi import FastAPI, Query
from pydantic import BaseModel


app = FastAPI(title="NBA Recommender", version="1.0.0")


class RecommendationFactor(BaseModel):
    key: str
    value: str
    contribution: float


class RecommendationItem(BaseModel):
    doctor_id: str
    score: float
    explanation: str
    recommended_action: str
    recommended_message: str
    recommended_pharmacy_id: str | None = None
    recommended_pharmacy_name: str | None = None
    factors: list[RecommendationFactor]


TIME_TOKEN_RE = re.compile(r"(?P<hour>\d{1,2})(?::(?P<minute>\d{2}))?\s*(?P<ampm>am|pm)?", re.IGNORECASE)


def compact_text(value: str | None, limit: int = 80) -> str:
    if not value:
        return ""
    normalized = " ".join(value.strip().split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3] + "..."


def derive_next_action(
    *,
    follow_up_required: Any,
    last_feedback_status: str | None,
    rescheduled_to: Any,
    visit_count_recent: int,
    days_since: int,
    target_product_focus: str | None,
    needs_pharmacy_check: bool = False,
    doctor_revisit_due_to_sales: bool = False,
    top_pharmacy_priority: bool = False,
    pharmacy_name: str | None = None,
    pharmacy_reason: str | None = None,
    top_pharmacy_name: str | None = None,
    focus_product_name: str | None = None,
) -> tuple[str, str]:
    product = compact_text(focus_product_name or target_product_focus, 40) or "the current product focus"
    if doctor_revisit_due_to_sales:
        reason = compact_text(pharmacy_reason, 80) or f"{product} is not moving in nearby pharmacies"
        return (
            "Meet Doctor Again",
            f"Revisit the doctor now because {reason}. Use the latest pharmacy evidence to reinforce why {product} should be prescribed.",
        )
    if needs_pharmacy_check:
        location = pharmacy_name or "the linked pharmacy"
        reason = compact_text(pharmacy_reason, 80) or "sell-out has stalled"
        return (
            "Visit Pharmacy First",
            f"Visit {location} first because {reason}, then use that field evidence to strengthen the doctor conversation around {product}.",
        )
    if top_pharmacy_priority and top_pharmacy_name:
        return (
            "Visit High-Performing Pharmacy First",
            f"Start at {top_pharmacy_name} because it is currently the strongest-performing pharmacy for {product}, then take that proof into the doctor discussion.",
        )
    if last_feedback_status == "RESCHEDULED" and rescheduled_to is not None:
        return (
            "Honor Rescheduled Follow-Up",
            f"Revisit the doctor now and reopen the discussion around {product} because the prior reschedule is due.",
        )
    if bool(follow_up_required):
        return (
            "Close Follow-Up Commitment",
            f"Visit this doctor next, resolve the pending follow-up, and position {product} with a concrete next step.",
        )
    if visit_count_recent == 0 or days_since >= 30:
        return (
            "Recover Coverage Gap",
            f"Prioritize a fresh coverage visit and lead with {product} to rebuild engagement after a long recency gap.",
        )
    if days_since <= 7:
        return (
            "Send Lightweight Check-In",
            f"A full revisit may be early; use a short reinforcement message around {product} unless a stronger field signal changes priority.",
        )
    return (
        "Progress Product Discussion",
        f"Use the next visit to advance the conversation on {product} and confirm the doctor's current prescribing interest.",
    )


def parse_time_value(value: Any) -> time | None:
    if value is None:
        return None
    if hasattr(value, "hour") and hasattr(value, "minute"):
        return value
    text = str(value).strip().lower()
    if not text:
        return None
    match = TIME_TOKEN_RE.search(text)
    if not match:
        return None
    hour = int(match.group("hour"))
    minute = int(match.group("minute") or 0)
    ampm = match.group("ampm")
    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    if hour > 23 or minute > 59:
        return None
    return datetime(2000, 1, 1, hour, minute).time()


def parse_time_window(value: str | None) -> tuple[time, time] | None:
    if not value:
        return None
    matches = list(TIME_TOKEN_RE.finditer(value))
    if len(matches) < 2:
        return None
    start = parse_time_value(matches[0].group(0))
    end = parse_time_value(matches[1].group(0))
    if start is None or end is None or start >= end:
        return None
    return start, end


def is_time_in_window(now_time: time, start: time | None, end: time | None) -> bool:
    if start is None or end is None:
        return False
    return start <= now_time <= end


def hours_until(now_time: time, target: time | None) -> float | None:
    if target is None:
        return None
    now_minutes = now_time.hour * 60 + now_time.minute
    target_minutes = target.hour * 60 + target.minute
    return (target_minutes - now_minutes) / 60.0


def load_scoring_config(cur: psycopg.Cursor[Any]) -> tuple[dict[str, float], dict[str, str], list[dict[str, Any]]]:
    cur.execute(
        """
        SELECT weights, messages, segments
        FROM scoring_config_versions
        WHERE is_active = TRUE
        ORDER BY version DESC
        LIMIT 1
        """
    )
    row = cur.fetchone()
    if row is None:
        return (
            {
                "tierA": 25.0,
                "tierB": 15.0,
                "tierC": 8.0,
                "tierDefault": 4.0,
                "priorityScale": 35.0,
                "recencyScale": 15.0,
                "followUpBonus": 20.0,
                "recentVisitPenalty": -10.0,
                "maxRecencyDays": 45.0,
            },
            {
                "templateTopDrivers": "{driver1}, {driver2}, {driver3}",
                "templateFallback": "Prioritized by active segment and recency",
            },
            [],
        )

    weights_raw, messages_raw, segments_raw = row
    weights = dict(weights_raw or {})
    messages = dict(messages_raw or {})
    segments = list(segments_raw or [])
    return weights, messages, segments


def db_conn_string() -> str:
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "nba")
    user = os.getenv("DB_USER", "nba")
    password = os.getenv("DB_PASSWORD", "nbapass")
    return f"host={host} port={port} dbname={db_name} user={user} password={password}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/recommendations", response_model=list[RecommendationItem])
def recommendations(
    user_id: str,
    limit: int = Query(default=5, ge=1, le=20),
) -> list[RecommendationItem]:
    now = datetime.now(timezone.utc)
    now_time = now.astimezone().time()
    with psycopg.connect(db_conn_string()) as conn:
        with conn.cursor() as cur:
            weights, messages, segments = load_scoring_config(cur)
            cur.execute(
                """
                SELECT d.id::text,
                       d.full_name,
                       d.tier,
                       d.priority_score,
                       d.notes,
                       d.target_product_focus,
                       d.availability_pattern,
                       d.availability_window,
                       d.scheduling_notes,
                       t.name as territory_name,
                       usp.workday_start,
                       usp.workday_end,
                       usp.break_start,
                       usp.break_end,
                       usp.max_visits_per_day,
                       usp.base_location_text,
                       usp.planning_notes,
                       lv.visit_time,
                       lv.follow_up_required
                       , lv.outcome
                       , lv.notes
                       , rf.status
                       , rf.reason
                       , rf.rescheduled_to
                       , daily_stats.visit_count_today
                       , stats.visit_count_90d
                       , stats.feedback_count_90d
                       , pf.pharmacy_name
                       , pf.pharmacy_id::text
                       , pf.prescribed
                       , pf.stock_available
                       , pf.notes
                       , pf.feedback_age_days
                       , focus_product.focus_product_name
                       , focus_product.focus_brand_name
                       , sales.order_count_30d
                       , sales.product_quantity_30d
                       , sales.product_amount_30d
                       , sales.top_pharmacy_name
                       , sales.top_pharmacy_id::text
                       , sales.top_pharmacy_quantity_30d
                       , sales.product_quantity_prev_30d
                FROM doctors d
                LEFT JOIN territories t ON t.id = d.territory_id
                LEFT JOIN user_schedule_preferences usp ON usp.user_id = %s::uuid
                LEFT JOIN LATERAL (
                    SELECT v.visit_time, v.follow_up_required, v.outcome, v.notes
                    FROM visits v
                    WHERE v.user_id = %s::uuid
                      AND v.doctor_id = d.id
                    ORDER BY v.visit_time DESC
                    LIMIT 1
                ) lv ON true
                LEFT JOIN LATERAL (
                    SELECT f.status, f.reason, f.rescheduled_to
                    FROM recommendation_feedback f
                    JOIN recommendations r ON r.id = f.recommendation_id
                    WHERE f.created_by_user_id = %s::uuid
                      AND r.doctor_id = d.id
                    ORDER BY f.created_at DESC
                    LIMIT 1
                ) rf ON true
                LEFT JOIN LATERAL (
                    SELECT COUNT(*) AS visit_count_today
                    FROM visits v_today
                    WHERE v_today.user_id = %s::uuid
                      AND DATE(v_today.visit_time AT TIME ZONE 'UTC') = CURRENT_DATE
                ) daily_stats ON true
                LEFT JOIN LATERAL (
                    SELECT ph.name AS pharmacy_name,
                           ph.id AS pharmacy_id,
                           fb.prescribed,
                           fb.stock_available,
                           fb.notes,
                           EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fb.captured_at)) / 86400.0 AS feedback_age_days,
                           fb.product_id
                    FROM pharmacy_feedback fb
                    JOIN pharmacies ph ON ph.id = fb.pharmacy_id
                    WHERE fb.mr_user_id = %s::uuid
                      AND fb.doctor_id = d.id
                    ORDER BY fb.captured_at DESC
                    LIMIT 1
                ) pf ON true
                LEFT JOIN LATERAL (
                    SELECT p.id AS focus_product_id,
                           p.name AS focus_product_name,
                           p.brand_name AS focus_brand_name
                    FROM products p
                    JOIN user_product_assignments upa ON upa.product_id = p.id
                    WHERE upa.user_id = %s::uuid
                      AND upa.starts_on <= CURRENT_DATE
                      AND (upa.ends_on IS NULL OR upa.ends_on >= CURRENT_DATE)
                      AND (
                        (pf.product_id IS NOT NULL AND p.id = pf.product_id)
                        OR (
                          pf.product_id IS NULL
                          AND d.target_product_focus IS NOT NULL
                          AND (
                            d.target_product_focus ILIKE '%%' || p.name || '%%'
                            OR (p.brand_name IS NOT NULL AND d.target_product_focus ILIKE '%%' || p.brand_name || '%%')
                          )
                        )
                      )
                    ORDER BY CASE WHEN pf.product_id IS NOT NULL AND p.id = pf.product_id THEN 0 ELSE 1 END,
                             LENGTH(p.name) DESC
                    LIMIT 1
                ) focus_product ON true
                LEFT JOIN LATERAL (
                    WITH recent_sales AS (
                        SELECT ph.id,
                               ph.name,
                               SUM(poi.quantity) AS qty
                        FROM pharmacy_orders po
                        JOIN pharmacy_order_items poi ON poi.order_id = po.id
                        JOIN pharmacies ph ON ph.id = po.pharmacy_id
                        WHERE po.territory_id = d.territory_id
                          AND (focus_product.focus_product_id IS NULL OR poi.product_id = focus_product.focus_product_id)
                          AND po.ordered_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                        GROUP BY ph.id, ph.name
                    )
                    SELECT COUNT(DISTINCT po.id) AS order_count_30d,
                           COALESCE(SUM(poi.quantity), 0) AS product_quantity_30d,
                           COALESCE(SUM(poi.amount), 0) AS product_amount_30d,
                           (SELECT rs.name FROM recent_sales rs ORDER BY rs.qty DESC, rs.name LIMIT 1) AS top_pharmacy_name,
                           (SELECT rs.id FROM recent_sales rs ORDER BY rs.qty DESC, rs.name LIMIT 1) AS top_pharmacy_id,
                           COALESCE((SELECT rs.qty FROM recent_sales rs ORDER BY rs.qty DESC, rs.name LIMIT 1), 0) AS top_pharmacy_quantity_30d,
                           COALESCE((
                               SELECT SUM(prev_poi.quantity)
                               FROM pharmacy_orders prev_po
                               JOIN pharmacy_order_items prev_poi ON prev_poi.order_id = prev_po.id
                               WHERE prev_po.territory_id = d.territory_id
                                 AND (focus_product.focus_product_id IS NULL OR prev_poi.product_id = focus_product.focus_product_id)
                                 AND prev_po.ordered_at >= CURRENT_TIMESTAMP - INTERVAL '60 days'
                                 AND prev_po.ordered_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
                           ), 0) AS product_quantity_prev_30d
                    FROM pharmacy_orders po
                    JOIN pharmacy_order_items poi ON poi.order_id = po.id
                    WHERE po.territory_id = d.territory_id
                      AND (focus_product.focus_product_id IS NULL OR poi.product_id = focus_product.focus_product_id)
                      AND po.ordered_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                ) sales ON true
                LEFT JOIN LATERAL (
                    SELECT
                      (
                        SELECT COUNT(*)
                        FROM visits v90
                        WHERE v90.user_id = %s::uuid
                          AND v90.doctor_id = d.id
                          AND v90.visit_time >= CURRENT_TIMESTAMP - INTERVAL '90 days'
                      ) AS visit_count_90d,
                      (
                        SELECT COUNT(*)
                        FROM recommendation_feedback f90
                        JOIN recommendations r90 ON r90.id = f90.recommendation_id
                        WHERE f90.created_by_user_id = %s::uuid
                          AND r90.user_id = %s::uuid
                          AND r90.doctor_id = d.id
                          AND f90.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
                      ) AS feedback_count_90d
                ) stats ON true
                WHERE d.territory_id IN (
                    SELECT ta.territory_id
                    FROM territory_assignments ta
                    WHERE ta.user_id = %s::uuid
                      AND ta.starts_on <= CURRENT_DATE
                      AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
                )
                """,
                (user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id),
            )
            rows = cur.fetchall()

    scored: list[dict[str, Any]] = []
    for (
        doctor_id,
        doctor_name,
        tier,
        priority_score,
        doctor_notes,
        target_product_focus,
        availability_pattern,
        availability_window,
        scheduling_notes,
        territory_name,
        workday_start,
        workday_end,
        break_start,
        break_end,
        max_visits_per_day,
        base_location_text,
        planning_notes,
        last_visit_time,
        follow_up_required,
        last_visit_outcome,
        last_visit_notes,
        last_feedback_status,
        last_feedback_reason,
        rescheduled_to,
        visit_count_today,
        visit_count_90d,
        feedback_count_90d,
        pharmacy_name,
        pharmacy_id,
        prescribed,
        stock_available,
        pharmacy_feedback_notes,
        pharmacy_feedback_age_days,
        focus_product_name,
        focus_brand_name,
        order_count_30d,
        product_quantity_30d,
        product_amount_30d,
        top_pharmacy_name,
        top_pharmacy_id,
        top_pharmacy_quantity_30d,
        product_quantity_prev_30d,
    ) in rows:
        tier_norm = (tier or "").strip().upper()
        priority = float(max(0, min(priority_score or 0, 100)))

        if last_visit_time is None:
            days_since = 60
            days_value = "never"
        else:
            days_since = max(0, int((now - last_visit_time).total_seconds() // 86400))
            days_value = str(days_since)

        max_recency_days = float(weights.get("maxRecencyDays", 45.0))
        tier_points_map = {
            "A": float(weights.get("tierA", 25.0)),
            "B": float(weights.get("tierB", 15.0)),
            "C": float(weights.get("tierC", 8.0)),
        }
        tier_points = tier_points_map.get(tier_norm, float(weights.get("tierDefault", 4.0)))
        priority_points = round((priority / 100.0) * float(weights.get("priorityScale", 35.0)), 2)
        recency_points = round(min(days_since, max_recency_days) / max_recency_days * float(weights.get("recencyScale", 15.0)), 2)
        follow_up_points = float(weights.get("followUpBonus", 20.0)) if bool(follow_up_required) else 0.0
        recent_visit_days = int(weights.get("recentVisitDays", 7))
        saturation_penalty = float(weights.get("recentVisitPenalty", -10.0)) if days_since <= recent_visit_days else 0.0
        visit_count_recent = int(visit_count_90d or 0)
        feedback_count_recent = int(feedback_count_90d or 0)
        visits_today = int(visit_count_today or 0)
        recent_order_count = int(order_count_30d or 0)
        recent_product_quantity = int(product_quantity_30d or 0)
        previous_product_quantity = int(product_quantity_prev_30d or 0)
        top_pharmacy_quantity = int(top_pharmacy_quantity_30d or 0)

        context_bonus = 0.0
        context_snippets: list[str] = []
        schedule_bonus = 0.0
        schedule_snippets: list[str] = []
        pharmacy_bonus = 0.0
        sales_trend_bonus = 0.0
        pharmacy_reason = ""
        needs_pharmacy_check = False
        doctor_revisit_due_to_sales = False
        top_pharmacy_priority = False

        workday_start_time = parse_time_value(workday_start)
        workday_end_time = parse_time_value(workday_end)
        break_start_time = parse_time_value(break_start)
        break_end_time = parse_time_value(break_end)
        doctor_window = parse_time_window(availability_window)

        if workday_start_time and workday_end_time:
            if is_time_in_window(now_time, workday_start_time, workday_end_time):
                schedule_bonus += 2.0
                schedule_snippets.append(
                    f"inside MR work window {workday_start_time.strftime('%H:%M')}-{workday_end_time.strftime('%H:%M')}"
                )
            else:
                schedule_bonus -= 14.0
                schedule_snippets.append(
                    f"outside MR work window {workday_start_time.strftime('%H:%M')}-{workday_end_time.strftime('%H:%M')}"
                )

        if break_start_time and break_end_time and is_time_in_window(now_time, break_start_time, break_end_time):
            schedule_bonus -= 8.0
            schedule_snippets.append(
                f"current time falls in MR break window {break_start_time.strftime('%H:%M')}-{break_end_time.strftime('%H:%M')}"
            )

        daily_capacity = int(max_visits_per_day or 0)
        if daily_capacity > 0:
            if visits_today >= daily_capacity:
                schedule_bonus -= 12.0
                schedule_snippets.append(f"daily visit limit reached ({visits_today}/{daily_capacity})")
            elif visits_today == daily_capacity - 1:
                schedule_bonus -= 4.0
                schedule_snippets.append(f"one slot left today ({visits_today}/{daily_capacity})")
            else:
                schedule_snippets.append(f"{max(0, daily_capacity - visits_today)} visit slots remain today")

        availability_points = 0.0
        availability_reason = ""
        if doctor_window:
            start_time, end_time = doctor_window
            if is_time_in_window(now_time, start_time, end_time):
                availability_points += 10.0
                availability_reason = f"doctor availability matches now ({start_time.strftime('%H:%M')}-{end_time.strftime('%H:%M')})"
            else:
                lead_hours = hours_until(now_time, start_time)
                if lead_hours is not None and 0 < lead_hours <= 2:
                    availability_points += 4.0
                    availability_reason = f"doctor availability opens soon at {start_time.strftime('%H:%M')}"
                else:
                    availability_points -= 5.0
                    availability_reason = f"outside doctor availability window {start_time.strftime('%H:%M')}-{end_time.strftime('%H:%M')}"
        elif availability_pattern:
            pattern = availability_pattern.strip().lower()
            hour = now_time.hour
            if "morning" in pattern:
                availability_points += 6.0 if hour < 12 else -3.0
                availability_reason = "doctor prefers morning visits"
            elif "afternoon" in pattern:
                availability_points += 6.0 if 12 <= hour < 17 else -3.0
                availability_reason = "doctor prefers afternoon visits"
            elif "evening" in pattern:
                availability_points += 6.0 if hour >= 17 else -3.0
                availability_reason = "doctor prefers evening visits"
            elif "weekend" in pattern:
                availability_reason = f"availability pattern: {compact_text(availability_pattern, 40)}"

        schedule_bonus += availability_points
        if availability_reason:
            schedule_snippets.append(availability_reason)

        if visit_count_recent == 0:
            context_bonus += 8.0
            context_snippets.append("no visits logged in the last 90 days")
        elif visit_count_recent <= 1:
            context_bonus += 4.0
            context_snippets.append(f"only {visit_count_recent} visit logged in the last 90 days")

        if last_feedback_status == "RESCHEDULED":
            context_bonus += 6.0
            reason_summary = compact_text(last_feedback_reason, 50)
            if rescheduled_to and rescheduled_to <= now:
                context_bonus += 6.0
                context_snippets.append("last recommendation was rescheduled and is now due")
            elif reason_summary:
                context_snippets.append(f"last recommendation was rescheduled: {reason_summary}")
        elif last_feedback_status == "SKIPPED":
            context_bonus += 3.0
            reason_summary = compact_text(last_feedback_reason, 50)
            context_snippets.append(f"last recommendation was skipped: {reason_summary or 'reason not recorded'}")
        elif last_feedback_status == "DONE":
            context_snippets.append("last recommendation for this doctor was completed")

        doctor_note_summary = compact_text(doctor_notes, 60)
        if doctor_note_summary:
            context_bonus += 2.0
            context_snippets.append(f"doctor notes: {doctor_note_summary}")

        last_visit_note_summary = compact_text(last_visit_notes, 60)
        if last_visit_outcome:
            context_snippets.append(f"last visit outcome: {compact_text(last_visit_outcome, 40)}")
        if last_visit_note_summary:
            context_snippets.append(f"last visit notes: {last_visit_note_summary}")

        if territory_name:
            context_snippets.append(f"territory: {territory_name}")
        if target_product_focus:
            context_bonus += 2.0
            context_snippets.append(f"target product: {compact_text(target_product_focus, 40)}")
        if availability_window or availability_pattern:
            context_bonus += 3.0
            availability_parts = [compact_text(availability_window, 32), compact_text(availability_pattern, 40)]
            availability_text = ", ".join(part for part in availability_parts if part)
            if availability_text:
                context_snippets.append(f"availability: {availability_text}")
        scheduling_note_summary = compact_text(scheduling_notes, 60)
        if scheduling_note_summary:
            context_bonus += 2.0
            context_snippets.append(f"scheduling notes: {scheduling_note_summary}")
        planning_note_summary = compact_text(planning_notes, 60)
        if planning_note_summary:
            context_snippets.append(f"MR plan notes: {planning_note_summary}")
        if base_location_text:
            context_snippets.append(f"base location: {compact_text(base_location_text, 40)}")

        focus_product_label = compact_text(focus_product_name or focus_brand_name or target_product_focus, 40)
        if pharmacy_name:
            feedback_notes_summary = compact_text(pharmacy_feedback_notes, 50)
            if prescribed is False:
                pharmacy_bonus += 10.0
                doctor_revisit_due_to_sales = True
                pharmacy_reason = f"{pharmacy_name} reports the doctor is not prescribing the product"
                context_snippets.append(f"pharmacy signal: not prescribing at {pharmacy_name}")
            if stock_available is False:
                pharmacy_bonus += 8.0
                doctor_revisit_due_to_sales = True
                pharmacy_reason = pharmacy_reason or f"{pharmacy_name} reports stock is unavailable"
                context_snippets.append(f"pharmacy signal: stock unavailable at {pharmacy_name}")
            if recent_order_count == 0:
                pharmacy_bonus += 6.0
                if pharmacy_feedback_age_days is not None and float(pharmacy_feedback_age_days) <= 21:
                    doctor_revisit_due_to_sales = True
                    pharmacy_reason = pharmacy_reason or f"{focus_product_label or 'the product'} is still not moving at {pharmacy_name}"
                else:
                    needs_pharmacy_check = True
                    pharmacy_reason = pharmacy_reason or f"sales have stalled in {pharmacy_name}"
                context_snippets.append(f"pharmacy sales stalled in the last 30 days near {pharmacy_name}")
            if feedback_notes_summary:
                context_snippets.append(f"pharmacy notes: {feedback_notes_summary}")
            if pharmacy_feedback_age_days is not None and float(pharmacy_feedback_age_days) <= 14:
                pharmacy_bonus += 3.0

        if focus_product_label:
            if recent_product_quantity == 0 and previous_product_quantity >= 20:
                sales_trend_bonus += 12.0
                if pharmacy_name and pharmacy_feedback_age_days is not None and float(pharmacy_feedback_age_days) <= 21:
                    doctor_revisit_due_to_sales = True
                    pharmacy_reason = pharmacy_reason or f"{focus_product_label} had sales earlier but has no sell-out in the last 30 days"
                else:
                    needs_pharmacy_check = True
                    pharmacy_reason = pharmacy_reason or f"{focus_product_label} has no recent sell-out in nearby pharmacies"
                context_snippets.append(f"sales trend: {focus_product_label} dropped from {previous_product_quantity} units to 0 in the last 30 days")
            elif previous_product_quantity >= 20 and recent_product_quantity <= previous_product_quantity * 0.5:
                sales_trend_bonus += 9.0
                if pharmacy_name and pharmacy_feedback_age_days is not None and float(pharmacy_feedback_age_days) <= 21:
                    doctor_revisit_due_to_sales = True
                    pharmacy_reason = pharmacy_reason or f"{focus_product_label} sell-out has weakened after recent pharmacy feedback"
                else:
                    needs_pharmacy_check = True
                    pharmacy_reason = pharmacy_reason or f"{focus_product_label} sell-out has fallen sharply in nearby pharmacies"
                context_snippets.append(
                    f"sales trend: {focus_product_label} fell from {previous_product_quantity} to {recent_product_quantity} units in the last 30 days"
                )
            elif top_pharmacy_name and recent_product_quantity >= 40 and top_pharmacy_quantity >= 15:
                sales_trend_bonus += 5.0
                top_pharmacy_priority = True
                context_snippets.append(
                    f"best-performing pharmacy: {top_pharmacy_name} moved {top_pharmacy_quantity} units of {focus_product_label} in the last 30 days"
                )

        recommended_pharmacy_id: str | None = None
        recommended_pharmacy_name: str | None = None
        if needs_pharmacy_check or doctor_revisit_due_to_sales:
            recommended_pharmacy_id = pharmacy_id or top_pharmacy_id
            recommended_pharmacy_name = pharmacy_name or top_pharmacy_name
        elif top_pharmacy_priority:
            recommended_pharmacy_id = top_pharmacy_id
            recommended_pharmacy_name = top_pharmacy_name

        segment_bonus_total = 0.0
        segment_tags: list[str] = []
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            seg_tier = str(segment.get("tier", "")).upper().strip()
            seg_priority_min = float(segment.get("priorityMin", 0))
            seg_follow_up = segment.get("followUpRequired", None)
            matches_tier = seg_tier == "" or seg_tier == tier_norm
            matches_priority = priority >= seg_priority_min
            matches_follow_up = seg_follow_up is None or bool(seg_follow_up) == bool(follow_up_required)
            if matches_tier and matches_priority and matches_follow_up:
                segment_bonus = float(segment.get("scoreBonus", 0.0))
                segment_bonus_total += segment_bonus
                segment_name = str(segment.get("name", "Segment"))
                segment_tags.append(segment_name)

        total_score = round(
            tier_points
            + priority_points
            + recency_points
            + follow_up_points
            + saturation_penalty
            + segment_bonus_total
            + context_bonus
            + pharmacy_bonus
            + sales_trend_bonus
            + schedule_bonus,
            2,
        )

        factors = [
            RecommendationFactor(key="tier", value=tier_norm or "UNKNOWN", contribution=tier_points),
            RecommendationFactor(key="priority_score", value=str(int(priority)), contribution=priority_points),
            RecommendationFactor(key="days_since_last_visit", value=days_value, contribution=recency_points),
            RecommendationFactor(
                key="follow_up_required",
                value="yes" if bool(follow_up_required) else "no",
                contribution=follow_up_points,
            ),
            RecommendationFactor(
                key="coverage_gap_90d",
                value=str(visit_count_recent),
                contribution=8.0 if visit_count_recent == 0 else 4.0 if visit_count_recent <= 1 else 0.0,
            ),
            RecommendationFactor(
                key="feedback_activity_90d",
                value=str(feedback_count_recent),
                contribution=0.0,
            ),
            RecommendationFactor(
                key="mr_capacity_today",
                value=f"{visits_today}/{daily_capacity or 8}",
                contribution=0.0 if daily_capacity <= 0 else round(-12.0 if visits_today >= daily_capacity else -4.0 if visits_today == daily_capacity - 1 else 1.0, 2),
            ),
        ]
        if saturation_penalty < 0:
            factors.append(
                RecommendationFactor(
                    key="recent_visit_penalty", value=f"{days_since} days", contribution=saturation_penalty
                )
            )
        if segment_bonus_total != 0:
            factors.append(
                RecommendationFactor(
                    key="segment_bonus",
                    value=", ".join(segment_tags) if segment_tags else "matched",
                    contribution=segment_bonus_total,
                )
            )
        if schedule_bonus != 0 or schedule_snippets:
            factors.append(
                RecommendationFactor(
                    key="time_of_day_fit",
                    value=" | ".join(schedule_snippets[:3]) if schedule_snippets else "schedule context applied",
                    contribution=round(schedule_bonus, 2),
                )
            )
        if context_bonus != 0:
            factors.append(
                RecommendationFactor(
                    key="retrieved_context",
                    value=" | ".join(context_snippets[:3]) if context_snippets else doctor_name,
                    contribution=round(context_bonus, 2),
                )
            )
        if pharmacy_bonus != 0:
            factors.append(
                RecommendationFactor(
                    key="pharmacy_follow_up_signal",
                    value=pharmacy_reason or pharmacy_name or "pharmacy feedback",
                    contribution=round(pharmacy_bonus, 2),
                )
            )
        if sales_trend_bonus != 0:
            factors.append(
                RecommendationFactor(
                    key="sales_trend_signal",
                    value=pharmacy_reason or top_pharmacy_name or focus_product_label or "sales trend detected",
                    contribution=round(sales_trend_bonus, 2),
                )
            )

        top = sorted(factors, key=lambda item: abs(item.contribution), reverse=True)[:3]
        template = str(messages.get("templateTopDrivers", "{driver1}, {driver2}, {driver3}"))
        explanation = template
        for idx in range(3):
            token = f"{{driver{idx + 1}}}"
            value = f"{top[idx].key}={top[idx].value}" if idx < len(top) else "-"
            explanation = explanation.replace(token, value)
        if not explanation.strip():
            explanation = str(messages.get("templateFallback", "Prioritized by active segment and recency"))
        if context_snippets:
            explanation = f"{explanation}. Context: {'; '.join(context_snippets[:3])}."
        recommended_action, recommended_message = derive_next_action(
            follow_up_required=follow_up_required,
            last_feedback_status=last_feedback_status,
            rescheduled_to=rescheduled_to,
            visit_count_recent=visit_count_recent,
            days_since=days_since,
            target_product_focus=target_product_focus,
            needs_pharmacy_check=needs_pharmacy_check,
            doctor_revisit_due_to_sales=doctor_revisit_due_to_sales,
            top_pharmacy_priority=top_pharmacy_priority,
            pharmacy_name=pharmacy_name,
            pharmacy_reason=pharmacy_reason,
            top_pharmacy_name=top_pharmacy_name,
            focus_product_name=focus_product_name or focus_brand_name,
        )
        scored.append(
            {
                "doctor_id": doctor_id,
                "score": total_score,
                "explanation": explanation,
                "recommended_action": recommended_action,
                "recommended_message": recommended_message,
                "recommended_pharmacy_id": recommended_pharmacy_id,
                "recommended_pharmacy_name": recommended_pharmacy_name,
                "factors": factors,
            }
        )

    ranked = sorted(scored, key=lambda item: item["score"], reverse=True)[:limit]
    return [RecommendationItem(**item) for item in ranked]
