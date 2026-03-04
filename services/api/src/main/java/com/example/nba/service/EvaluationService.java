package com.example.nba.service;

import com.example.nba.dto.EvaluationDriverMetricResponse;
import com.example.nba.dto.EvaluationSummaryResponse;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EvaluationService {
  private final NamedParameterJdbcTemplate jdbc;

  public EvaluationService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public EvaluationSummaryResponse summarize(UUID userId, UUID doctorId, LocalDate from, LocalDate to) {
    if (from != null && to != null && from.isAfter(to)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
    }

    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("userId", userId, Types.OTHER)
        .addValue("doctorId", doctorId, Types.OTHER)
        .addValue("fromTs", fromTs, Types.TIMESTAMP)
        .addValue("toTs", toTs, Types.TIMESTAMP);

    String summarySql = """
        WITH recommendation_scope AS (
          SELECT r.*
          FROM recommendations r
          WHERE (CAST(:userId AS UUID) IS NULL OR r.user_id = CAST(:userId AS UUID))
            AND (CAST(:doctorId AS UUID) IS NULL OR r.doctor_id = CAST(:doctorId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR r.created_at >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR r.created_at < CAST(:toTs AS TIMESTAMP))
        ),
        latest_feedback AS (
          SELECT DISTINCT ON (rf.recommendation_id)
                 rf.recommendation_id,
                 rf.status,
                 rf.override_doctor_id,
                 rf.created_at
          FROM recommendation_feedback rf
          JOIN recommendation_scope rs ON rs.id = rf.recommendation_id
          ORDER BY rf.recommendation_id, rf.created_at DESC
        ),
        follow_through AS (
          SELECT rs.id AS recommendation_id,
                 EXISTS (
                   SELECT 1
                   FROM visits v
                   WHERE v.user_id = rs.user_id
                     AND v.doctor_id = rs.doctor_id
                     AND v.visit_time >= rs.created_at
                     AND v.visit_time < rs.created_at + INTERVAL '7 days'
                 ) AS visited_within_7d
          FROM recommendation_scope rs
        )
        SELECT COUNT(*) AS total_recommendations,
               COUNT(lf.recommendation_id) AS recommendations_with_feedback,
               ROUND((COUNT(lf.recommendation_id)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS feedback_coverage_rate,
               ROUND((COUNT(*) FILTER (WHERE lf.status = 'DONE')::numeric / NULLIF(COUNT(lf.recommendation_id), 0)) * 100.0, 2) AS done_rate,
               ROUND((COUNT(*) FILTER (WHERE lf.status = 'SKIPPED')::numeric / NULLIF(COUNT(lf.recommendation_id), 0)) * 100.0, 2) AS skipped_rate,
               ROUND((COUNT(*) FILTER (WHERE lf.status = 'RESCHEDULED')::numeric / NULLIF(COUNT(lf.recommendation_id), 0)) * 100.0, 2) AS rescheduled_rate,
               ROUND((COUNT(*) FILTER (WHERE lf.override_doctor_id IS NOT NULL)::numeric / NULLIF(COUNT(lf.recommendation_id), 0)) * 100.0, 2) AS override_rate,
               ROUND(AVG(EXTRACT(EPOCH FROM (lf.created_at - rs.created_at)) / 3600.0)::numeric, 2) AS avg_feedback_latency_hours,
               ROUND((COUNT(*) FILTER (WHERE ft.visited_within_7d)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS visit_follow_through_rate,
               ROUND(AVG(rs.score) FILTER (WHERE lf.status = 'DONE')::numeric, 2) AS avg_score_accepted,
               ROUND(AVG(rs.score) FILTER (WHERE lf.status = 'SKIPPED')::numeric, 2) AS avg_score_skipped
        FROM recommendation_scope rs
        LEFT JOIN latest_feedback lf ON lf.recommendation_id = rs.id
        LEFT JOIN follow_through ft ON ft.recommendation_id = rs.id
        """;

    EvaluationSummaryResponse summary = jdbc.query(summarySql, params, rs -> {
      if (!rs.next()) {
        return new EvaluationSummaryResponse(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, List.of());
      }
      return new EvaluationSummaryResponse(
          rs.getLong("total_recommendations"),
          rs.getLong("recommendations_with_feedback"),
          rs.getDouble("feedback_coverage_rate"),
          rs.getDouble("done_rate"),
          rs.getDouble("skipped_rate"),
          rs.getDouble("rescheduled_rate"),
          rs.getDouble("override_rate"),
          rs.getObject("avg_feedback_latency_hours") == null ? 0.0 : rs.getDouble("avg_feedback_latency_hours"),
          rs.getDouble("visit_follow_through_rate"),
          rs.getObject("avg_score_accepted") == null ? 0.0 : rs.getDouble("avg_score_accepted"),
          rs.getObject("avg_score_skipped") == null ? 0.0 : rs.getDouble("avg_score_skipped"),
          List.of()
      );
    });

    String driverSql = """
        WITH recommendation_scope AS (
          SELECT r.id
          FROM recommendations r
          WHERE (CAST(:userId AS UUID) IS NULL OR r.user_id = CAST(:userId AS UUID))
            AND (CAST(:doctorId AS UUID) IS NULL OR r.doctor_id = CAST(:doctorId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR r.created_at >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR r.created_at < CAST(:toTs AS TIMESTAMP))
        ),
        latest_feedback AS (
          SELECT DISTINCT ON (rf.recommendation_id)
                 rf.recommendation_id,
                 rf.status
          FROM recommendation_feedback rf
          JOIN recommendation_scope rs ON rs.id = rf.recommendation_id
          ORDER BY rf.recommendation_id, rf.created_at DESC
        )
        SELECT rfct.factor_key,
               COUNT(*) AS recommendation_count,
               ROUND((COUNT(*) FILTER (WHERE lf.status = 'DONE')::numeric / NULLIF(COUNT(lf.recommendation_id), 0)) * 100.0, 2) AS done_rate
        FROM recommendation_factors rfct
        JOIN recommendation_scope rs ON rs.id = rfct.recommendation_id
        LEFT JOIN latest_feedback lf ON lf.recommendation_id = rfct.recommendation_id
        GROUP BY rfct.factor_key
        ORDER BY recommendation_count DESC, done_rate DESC NULLS LAST
        LIMIT 5
        """;

    List<EvaluationDriverMetricResponse> drivers = jdbc.query(driverSql, params, (rs, rowNum) ->
        new EvaluationDriverMetricResponse(
            rs.getString("factor_key"),
            rs.getLong("recommendation_count"),
            rs.getObject("done_rate") == null ? 0.0 : rs.getDouble("done_rate")
        )
    );

    return new EvaluationSummaryResponse(
        summary.totalRecommendations(),
        summary.recommendationsWithFeedback(),
        summary.feedbackCoverageRate(),
        summary.doneRate(),
        summary.skippedRate(),
        summary.rescheduledRate(),
        summary.overrideRate(),
        summary.avgFeedbackLatencyHours(),
        summary.visitFollowThroughRate(),
        summary.avgScoreAccepted(),
        summary.avgScoreSkipped(),
        drivers
    );
  }
}
