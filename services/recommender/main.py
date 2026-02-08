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

        tier_points_map = {"A": 25.0, "B": 15.0, "C": 8.0}
        tier_points = tier_points_map.get(tier_norm, 4.0)
        priority_points = round((priority / 100.0) * 35.0, 2)
        recency_points = round(min(days_since, 45) / 45.0 * 15.0, 2)
        follow_up_points = 20.0 if bool(follow_up_required) else 0.0
        saturation_penalty = -10.0 if days_since <= 7 else 0.0

        total_score = round(
            tier_points + priority_points + recency_points + follow_up_points + saturation_penalty,
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

        top = sorted(factors, key=lambda item: abs(item.contribution), reverse=True)[:3]
        explanation = ", ".join(f"{item.key}={item.value}" for item in top)
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
