package com.example.nba.service;

import com.example.nba.dto.ComplianceAnalyticsResponse;
import com.example.nba.dto.CoverageTierAnalyticsResponse;
import com.example.nba.dto.ManagerAnalyticsResponse;
import com.example.nba.dto.MissedHighPriorityResponse;
import com.example.nba.dto.MrComplianceRowResponse;
import com.example.nba.dto.TerritoryOverviewResponse;
import java.sql.ResultSet;
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

  public List<TerritoryOverviewResponse> territoryOverview(LocalDate from, LocalDate to) {
    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));

    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("fromTs", fromTs)
        .addValue("toTs", toTs);

    String sql = """
        WITH active_assignments AS (
          SELECT territory_id, COUNT(DISTINCT user_id) AS assigned_mr_count
          FROM territory_assignments
          WHERE starts_on <= CURRENT_DATE
            AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
          GROUP BY territory_id
        ),
        doctor_counts AS (
          SELECT territory_id, COUNT(*) AS doctor_count
          FROM doctors
          GROUP BY territory_id
        ),
        visit_stats AS (
          SELECT d.territory_id,
                 COUNT(v.id) AS visit_count,
                 MAX(v.visit_time) AS last_visit_time
          FROM doctors d
          LEFT JOIN visits v ON v.doctor_id = d.id
             AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
             AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
          GROUP BY d.territory_id
        )
        SELECT t.id AS territory_id,
               t.name AS territory_name,
               t.code AS territory_code,
               COALESCE(aa.assigned_mr_count, 0) AS assigned_mr_count,
               COALESCE(dc.doctor_count, 0) AS doctor_count,
               COALESCE(vs.visit_count, 0) AS visit_count,
               vs.last_visit_time
        FROM territories t
        LEFT JOIN active_assignments aa ON aa.territory_id = t.id
        LEFT JOIN doctor_counts dc ON dc.territory_id = t.id
        LEFT JOIN visit_stats vs ON vs.territory_id = t.id
        ORDER BY t.name
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new TerritoryOverviewResponse(
        readUuid(rs, "territory_id"),
        rs.getString("territory_name"),
        rs.getString("territory_code"),
        rs.getLong("assigned_mr_count"),
        rs.getLong("doctor_count"),
        rs.getLong("visit_count"),
        toOffsetDateTime(rs, "last_visit_time")
    ));
  }

  private List<CoverageTierAnalyticsResponse> queryCoverageByTier(MapSqlParameterSource params) {
    String sql = """
        WITH doctor_scope AS (
          SELECT d.id, d.tier
          FROM doctors d
          WHERE (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
            AND (CAST(:mrId AS UUID) IS NULL OR d.territory_id IN (
              SELECT ta.territory_id
              FROM territory_assignments ta
              WHERE ta.user_id = CAST(:mrId AS UUID)
                AND ta.starts_on <= CURRENT_DATE
                AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
            ))
        ),
        visit_scope AS (
          SELECT v.doctor_id, v.visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (CAST(:mrId AS UUID) IS NULL OR v.user_id = CAST(:mrId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
        ),
        last_visit_scope AS (
          SELECT v.doctor_id, MAX(v.visit_time) AS last_visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (CAST(:mrId AS UUID) IS NULL OR v.user_id = CAST(:mrId AS UUID))
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
            AND (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
            AND (CAST(:mrId AS UUID) IS NULL OR d.territory_id IN (
              SELECT ta.territory_id
              FROM territory_assignments ta
              WHERE ta.user_id = CAST(:mrId AS UUID)
                AND ta.starts_on <= CURRENT_DATE
                AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
            ))
        ),
        visits_in_range AS (
          SELECT v.doctor_id, COUNT(*) AS visit_count
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (CAST(:mrId AS UUID) IS NULL OR v.user_id = CAST(:mrId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
          GROUP BY v.doctor_id
        ),
        last_visit AS (
          SELECT v.doctor_id, MAX(v.visit_time) AS last_visit_time
          FROM visits v
          JOIN doctor_scope ds ON ds.id = v.doctor_id
          WHERE (CAST(:mrId AS UUID) IS NULL OR v.user_id = CAST(:mrId AS UUID))
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
        readUuid(rs, "doctor_id"),
        rs.getString("full_name"),
        rs.getString("tier"),
        rs.getInt("priority_score"),
        rs.getString("territory_name"),
        toOffsetDateTime(rs, "last_visit_time")
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
        WHERE (CAST(:mrId AS UUID) IS NULL OR rf.created_by_user_id = CAST(:mrId AS UUID))
          AND (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
          AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR rf.created_at >= CAST(:fromTs AS TIMESTAMP))
          AND (CAST(:toTs AS TIMESTAMP) IS NULL OR rf.created_at < CAST(:toTs AS TIMESTAMP))
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
        WHERE (CAST(:mrId AS UUID) IS NULL OR rf.created_by_user_id = CAST(:mrId AS UUID))
          AND (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
          AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR rf.created_at >= CAST(:fromTs AS TIMESTAMP))
          AND (CAST(:toTs AS TIMESTAMP) IS NULL OR rf.created_at < CAST(:toTs AS TIMESTAMP))
        GROUP BY u.id, u.full_name
        ORDER BY feedback_count DESC, u.full_name
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new MrComplianceRowResponse(
        readUuid(rs, "mr_id"),
        rs.getString("mr_name"),
        rs.getLong("feedback_count"),
        rs.getDouble("done_rate"),
        rs.getDouble("override_rate"),
        rs.getDouble("skipped_rate")
    ));
  }

  private OffsetDateTime toOffsetDateTime(ResultSet rs, String columnName) throws java.sql.SQLException {
    Timestamp ts = rs.getTimestamp(columnName);
    return ts == null ? null : ts.toInstant().atOffset(ZoneOffset.UTC);
  }

  private UUID readUuid(ResultSet rs, String columnName) throws java.sql.SQLException {
    Object value = rs.getObject(columnName);
    if (value == null) {
      return null;
    }
    if (value instanceof UUID uuid) {
      return uuid;
    }
    return UUID.fromString(String.valueOf(value));
  }
}
