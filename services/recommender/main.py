import os
from datetime import datetime, timezone
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
    factors: list[RecommendationFactor]


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
    with psycopg.connect(db_conn_string()) as conn:
        with conn.cursor() as cur:
            weights, messages, segments = load_scoring_config(cur)
            cur.execute(
                """
                SELECT d.id::text,
                       d.tier,
                       d.priority_score,
                       lv.visit_time,
                       lv.follow_up_required
                FROM doctors d
                LEFT JOIN LATERAL (
                    SELECT v.visit_time, v.follow_up_required
                    FROM visits v
                    WHERE v.user_id = %s::uuid
                      AND v.doctor_id = d.id
                    ORDER BY v.visit_time DESC
                    LIMIT 1
                ) lv ON true
                WHERE d.territory_id IN (
                    SELECT ta.territory_id
                    FROM territory_assignments ta
                    WHERE ta.user_id = %s::uuid
                      AND ta.starts_on <= CURRENT_DATE
                      AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
                )
                """,
                (user_id, user_id),
            )
            rows = cur.fetchall()

    scored: list[dict[str, Any]] = []
    for doctor_id, tier, priority_score, last_visit_time, follow_up_required in rows:
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
            tier_points + priority_points + recency_points + follow_up_points + saturation_penalty + segment_bonus_total,
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

        top = sorted(factors, key=lambda item: abs(item.contribution), reverse=True)[:3]
        template = str(messages.get("templateTopDrivers", "{driver1}, {driver2}, {driver3}"))
        explanation = template
        for idx in range(3):
            token = f"{{driver{idx + 1}}}"
            value = f"{top[idx].key}={top[idx].value}" if idx < len(top) else "-"
            explanation = explanation.replace(token, value)
        if not explanation.strip():
            explanation = str(messages.get("templateFallback", "Prioritized by active segment and recency"))
        scored.append(
            {
                "doctor_id": doctor_id,
                "score": total_score,
                "explanation": explanation,
                "factors": factors,
            }
        )

    ranked = sorted(scored, key=lambda item: item["score"], reverse=True)[:limit]
    return [RecommendationItem(**item) for item in ranked]
