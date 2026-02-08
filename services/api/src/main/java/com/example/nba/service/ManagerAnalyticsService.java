package com.example.nba.service;

import com.example.nba.dto.ComplianceAnalyticsResponse;
import com.example.nba.dto.CoverageTierAnalyticsResponse;
import com.example.nba.dto.ManagerAnalyticsResponse;
import com.example.nba.dto.MissedHighPriorityResponse;
import com.example.nba.dto.MrComplianceRowResponse;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class ManagerAnalyticsService {
  private final NamedParameterJdbcTemplate jdbc;

  public ManagerAnalyticsService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public ManagerAnalyticsResponse getDashboard(UUID mrId, UUID territoryId, LocalDate from, LocalDate to) {
    if (from != null && to != null && from.isAfter(to)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
    }

    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));

    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("mrId", mrId)
        .addValue("territoryId", territoryId)
        .addValue("fromTs", fromTs)
        .addValue("toTs", toTs);

    List<CoverageTierAnalyticsResponse> coverage = queryCoverageByTier(params);
    List<MissedHighPriorityResponse> missed = queryMissedHighPriority(params);
    ComplianceAnalyticsResponse compliance = queryCompliance(params);
    List<MrComplianceRowResponse> byMr = queryComplianceByMr(params);

    return new ManagerAnalyticsResponse(coverage, missed, compliance, byMr);
  }

  private List<CoverageTierAnalyticsResponse> queryCoverageByTier(MapSqlParameterSource params) {
    String sql = """
        WITH doctor_scope AS (
          SELECT d.id, d.tier
          FROM doctors d
          WHERE (:territoryId IS NULL OR d.territory_id = :territoryId)
            AND (:mrId IS NULL OR d.territory_id IN (
              SELECT ta.territory_id
              FROM territory_assignments ta
              WHERE ta.user_id = :mrId
                AND ta.starts_on <= CURRENT_DATE
                AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
            ))
        ),
        visit_scope AS (
          SELECT v.doctor_id, v.visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (:mrId IS NULL OR v.user_id = :mrId)
            AND (:fromTs IS NULL OR v.visit_time >= :fromTs)
            AND (:toTs IS NULL OR v.visit_time < :toTs)
        ),
        last_visit_scope AS (
          SELECT v.doctor_id, MAX(v.visit_time) AS last_visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (:mrId IS NULL OR v.user_id = :mrId)
          GROUP BY v.doctor_id
        )
        SELECT ds.tier AS tier,
               COUNT(*) AS doctor_count,
               COUNT(DISTINCT vs.doctor_id) AS visited_doctors,
               COUNT(vs.doctor_id) AS total_visits,
               ROUND(COUNT(vs.doctor_id)::numeric / NULLIF(COUNT(*), 0), 2) AS avg_visits_per_doctor,
               ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - lvs.last_visit_time)) / 86400.0)::numeric, 2) AS avg_days_since_last_visit
        FROM doctor_scope ds
        LEFT JOIN visit_scope vs ON vs.doctor_id = ds.id
        LEFT JOIN last_visit_scope lvs ON lvs.doctor_id = ds.id
        GROUP BY ds.tier
        ORDER BY ds.tier
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new CoverageTierAnalyticsResponse(
        rs.getString("tier"),
        rs.getLong("doctor_count"),
        rs.getLong("visited_doctors"),
        rs.getLong("total_visits"),
        rs.getDouble("avg_visits_per_doctor"),
        rs.getObject("avg_days_since_last_visit") == null ? null : rs.getDouble("avg_days_since_last_visit")
    ));
  }

  private List<MissedHighPriorityResponse> queryMissedHighPriority(MapSqlParameterSource params) {
    String sql = """
        WITH doctor_scope AS (
          SELECT d.id, d.full_name, d.tier, d.priority_score, d.territory_id
          FROM doctors d
          WHERE d.priority_score >= 80
            AND (:territoryId IS NULL OR d.territory_id = :territoryId)
            AND (:mrId IS NULL OR d.territory_id IN (
              SELECT ta.territory_id
              FROM territory_assignments ta
              WHERE ta.user_id = :mrId
                AND ta.starts_on <= CURRENT_DATE
                AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
            ))
        ),
        visits_in_range AS (
          SELECT v.doctor_id, COUNT(*) AS visit_count
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (:mrId IS NULL OR v.user_id = :mrId)
            AND (:fromTs IS NULL OR v.visit_time >= :fromTs)
            AND (:toTs IS NULL OR v.visit_time < :toTs)
          GROUP BY v.doctor_id
        ),
        last_visit AS (
          SELECT v.doctor_id, MAX(v.visit_time) AS last_visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (:mrId IS NULL OR v.user_id = :mrId)
          GROUP BY v.doctor_id
        )
        SELECT ds.id AS doctor_id,
               ds.full_name,
               ds.tier,
               ds.priority_score,
               t.name AS territory_name,
               lv.last_visit_time
        FROM doctor_scope ds
        LEFT JOIN visits_in_range vir ON vir.doctor_id = ds.id
        LEFT JOIN last_visit lv ON lv.doctor_id = ds.id
        LEFT JOIN territories t ON t.id = ds.territory_id
        WHERE COALESCE(vir.visit_count, 0) = 0
        ORDER BY ds.priority_score DESC, lv.last_visit_time NULLS FIRST
        LIMIT 50
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new MissedHighPriorityResponse(
        UUID.fromString(rs.getString("doctor_id")),
        rs.getString("full_name"),
        rs.getString("tier"),
        rs.getInt("priority_score"),
        rs.getString("territory_name"),
        rs.getObject("last_visit_time") == null ? null : rs.getObject("last_visit_time", OffsetDateTime.class)
    ));
  }

  private ComplianceAnalyticsResponse queryCompliance(MapSqlParameterSource params) {
    String sql = """
        SELECT COUNT(*) AS total_feedback,
               COUNT(*) FILTER (WHERE rf.status = 'DONE') AS done_count,
               COUNT(*) FILTER (WHERE rf.status = 'SKIPPED') AS skipped_count,
               COUNT(*) FILTER (WHERE rf.status = 'RESCHEDULED') AS rescheduled_count,
               COUNT(*) FILTER (WHERE rf.override_doctor_id IS NOT NULL) AS override_count,
               ROUND((COUNT(*) FILTER (WHERE rf.status = 'DONE')::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS done_rate,
               ROUND((COUNT(*) FILTER (WHERE rf.override_doctor_id IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS override_rate
        FROM recommendation_feedback rf
        JOIN recommendations r ON r.id = rf.recommendation_id
        JOIN doctors d ON d.id = r.doctor_id
        WHERE (:mrId IS NULL OR rf.created_by_user_id = :mrId)
          AND (:territoryId IS NULL OR d.territory_id = :territoryId)
          AND (:fromTs IS NULL OR rf.created_at >= :fromTs)
          AND (:toTs IS NULL OR rf.created_at < :toTs)
        """;

    return jdbc.query(sql, params, rs -> {
      if (!rs.next()) {
        return new ComplianceAnalyticsResponse(0, 0, 0, 0, 0, 0, 0);
      }
      return new ComplianceAnalyticsResponse(
          rs.getLong("total_feedback"),
          rs.getLong("done_count"),
          rs.getLong("skipped_count"),
          rs.getLong("rescheduled_count"),
          rs.getLong("override_count"),
          rs.getDouble("done_rate"),
          rs.getDouble("override_rate")
      );
    });
  }

  private List<MrComplianceRowResponse> queryComplianceByMr(MapSqlParameterSource params) {
    String sql = """
        SELECT u.id AS mr_id,
               u.full_name AS mr_name,
               COUNT(*) AS feedback_count,
               ROUND((COUNT(*) FILTER (WHERE rf.status = 'DONE')::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS done_rate,
               ROUND((COUNT(*) FILTER (WHERE rf.override_doctor_id IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS override_rate,
               ROUND((COUNT(*) FILTER (WHERE rf.status = 'SKIPPED')::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS skipped_rate
        FROM recommendation_feedback rf
        JOIN users u ON u.id = rf.created_by_user_id
        JOIN recommendations r ON r.id = rf.recommendation_id
        JOIN doctors d ON d.id = r.doctor_id
        WHERE (:mrId IS NULL OR rf.created_by_user_id = :mrId)
          AND (:territoryId IS NULL OR d.territory_id = :territoryId)
          AND (:fromTs IS NULL OR rf.created_at >= :fromTs)
          AND (:toTs IS NULL OR rf.created_at < :toTs)
        GROUP BY u.id, u.full_name
        ORDER BY feedback_count DESC, u.full_name
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new MrComplianceRowResponse(
        UUID.fromString(rs.getString("mr_id")),
        rs.getString("mr_name"),
        rs.getLong("feedback_count"),
        rs.getDouble("done_rate"),
        rs.getDouble("override_rate"),
        rs.getDouble("skipped_rate")
    ));
  }
}
