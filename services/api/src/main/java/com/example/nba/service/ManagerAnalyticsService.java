package com.example.nba.service;

import com.example.nba.dto.ComplianceAnalyticsResponse;
import com.example.nba.dto.CoverageTierAnalyticsResponse;
import com.example.nba.dto.ManagerAnalyticsResponse;
import com.example.nba.dto.ManagerCoachingSummaryResponse;
import com.example.nba.dto.MissedHighPriorityResponse;
import com.example.nba.dto.MrCoachingRowResponse;
import com.example.nba.dto.MrComplianceRowResponse;
import com.example.nba.dto.SalesRepTargetProgressResponse;
import com.example.nba.dto.SalesTargetSummaryResponse;
import com.example.nba.dto.TerritoryOverviewResponse;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.sql.Types;
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

  public ManagerAnalyticsResponse getDashboard(
      UUID mrId,
      UUID territoryId,
      LocalDate from,
      LocalDate to,
      LocalDate weekStart
  ) {
    if (from != null && to != null && from.isAfter(to)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
    }

    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
    LocalDate effectiveWeekStart = (weekStart != null ? weekStart : (from != null ? from : LocalDate.now()))
        .with(java.time.DayOfWeek.MONDAY);

    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("mrId", mrId, Types.OTHER)
        .addValue("territoryId", territoryId, Types.OTHER)
        .addValue("fromTs", fromTs, Types.TIMESTAMP)
        .addValue("toTs", toTs, Types.TIMESTAMP)
        .addValue("weekStart", java.sql.Date.valueOf(effectiveWeekStart), Types.DATE);

    List<CoverageTierAnalyticsResponse> coverage = queryCoverageByTier(params);
    List<MissedHighPriorityResponse> missed = queryMissedHighPriority(params);
    ComplianceAnalyticsResponse compliance = queryCompliance(params);
    List<MrComplianceRowResponse> byMr = queryComplianceByMr(params);
    ManagerCoachingSummaryResponse coachingSummary = queryCoachingSummary(params);
    List<MrCoachingRowResponse> coachingByMr = queryCoachingByMr(params);
    SalesTargetSummaryResponse salesTargetSummary = querySalesTargetSummary(params);
    List<SalesRepTargetProgressResponse> salesTargetProgress = querySalesTargetProgress(params);

    return new ManagerAnalyticsResponse(
        coverage,
        missed,
        compliance,
        byMr,
        coachingSummary,
        coachingByMr,
        salesTargetSummary,
        salesTargetProgress
    );
  }

  public List<TerritoryOverviewResponse> territoryOverview(LocalDate from, LocalDate to) {
    if (from != null && to != null && from.isAfter(to)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must be before or equal to to");
    }

    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));

    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("fromTs", fromTs, Types.TIMESTAMP)
        .addValue("toTs", toTs, Types.TIMESTAMP);

    String sql = """
        WITH active_assignments AS (
          SELECT ta.territory_id, COUNT(DISTINCT ta.user_id) AS assigned_mr_count
          FROM territory_assignments ta
          JOIN user_roles ur ON ur.user_id = ta.user_id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'MR'
            AND ta.starts_on <= CURRENT_DATE
            AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
          GROUP BY ta.territory_id
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

  private ManagerCoachingSummaryResponse queryCoachingSummary(MapSqlParameterSource params) {
    String sql = """
        WITH mr_scope AS (
          SELECT DISTINCT u.id, u.full_name
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'MR'
            AND (CAST(:mrId AS UUID) IS NULL OR u.id = CAST(:mrId AS UUID))
            AND (
              CAST(:territoryId AS UUID) IS NULL OR EXISTS (
                SELECT 1
                FROM territory_assignments ta
                WHERE ta.user_id = u.id
                  AND ta.territory_id = CAST(:territoryId AS UUID)
                  AND ta.starts_on <= CURRENT_DATE
                  AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
              )
            )
        ),
        visit_scope AS (
          SELECT v.user_id,
                 COUNT(*) AS total_visits,
                 COUNT(*) FILTER (
                   WHERE usp.user_id IS NOT NULL
                     AND (
                       (usp.workday_start IS NOT NULL AND usp.workday_end IS NOT NULL
                        AND CAST(v.visit_time AT TIME ZONE 'UTC' AS time) BETWEEN usp.workday_start AND usp.workday_end)
                       AND NOT (
                         usp.break_start IS NOT NULL
                         AND usp.break_end IS NOT NULL
                         AND CAST(v.visit_time AT TIME ZONE 'UTC' AS time) BETWEEN usp.break_start AND usp.break_end
                       )
                     )
                 ) AS workday_visits,
                 COUNT(DISTINCT DATE(v.visit_time AT TIME ZONE 'UTC')) AS active_days,
                 AVG(day_counts.daily_visits::numeric) AS avg_daily_visits
          FROM visits v
          JOIN mr_scope ms ON ms.id = v.user_id
          LEFT JOIN user_schedule_preferences usp ON usp.user_id = v.user_id
          JOIN (
            SELECT v2.user_id, DATE(v2.visit_time AT TIME ZONE 'UTC') AS visit_day, COUNT(*) AS daily_visits
            FROM visits v2
            WHERE (CAST(:fromTs AS TIMESTAMP) IS NULL OR v2.visit_time >= CAST(:fromTs AS TIMESTAMP))
              AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v2.visit_time < CAST(:toTs AS TIMESTAMP))
            GROUP BY v2.user_id, DATE(v2.visit_time AT TIME ZONE 'UTC')
          ) day_counts ON day_counts.user_id = v.user_id
          AND day_counts.visit_day = DATE(v.visit_time AT TIME ZONE 'UTC')
          WHERE (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
          GROUP BY v.user_id
        ),
        overdue_reschedules AS (
          SELECT rf.created_by_user_id AS user_id, COUNT(*) AS overdue_count
          FROM recommendation_feedback rf
          JOIN recommendations r ON r.id = rf.recommendation_id
          JOIN doctors d ON d.id = r.doctor_id
          WHERE rf.status = 'RESCHEDULED'
            AND rf.rescheduled_to IS NOT NULL
            AND rf.rescheduled_to < CURRENT_TIMESTAMP
            AND (CAST(:mrId AS UUID) IS NULL OR rf.created_by_user_id = CAST(:mrId AS UUID))
            AND (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR rf.created_at >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR rf.created_at < CAST(:toTs AS TIMESTAMP))
          GROUP BY rf.created_by_user_id
        )
        SELECT COUNT(*) AS total_mr_count,
               COUNT(*) FILTER (WHERE usp.user_id IS NOT NULL) AS configured_schedule_count,
               ROUND((COUNT(*) FILTER (WHERE usp.user_id IS NOT NULL)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS schedule_coverage_rate,
               ROUND((SUM(COALESCE(vs.workday_visits, 0))::numeric / NULLIF(SUM(COALESCE(vs.total_visits, 0)), 0)) * 100.0, 2) AS workday_visit_rate,
               ROUND(AVG(
                 CASE
                   WHEN usp.user_id IS NULL OR usp.max_visits_per_day IS NULL OR usp.max_visits_per_day = 0 OR COALESCE(vs.active_days, 0) = 0
                     THEN NULL
                   ELSE LEAST(100.0, (COALESCE(vs.avg_daily_visits, 0) / usp.max_visits_per_day) * 100.0)
                 END
               )::numeric, 2) AS plan_adherence_rate,
               SUM(COALESCE(orx.overdue_count, 0)) AS overdue_reschedules,
               COUNT(*) FILTER (
                 WHERE COALESCE(orx.overdue_count, 0) > 0
                    OR (usp.user_id IS NULL)
                    OR (
                      COALESCE(vs.total_visits, 0) > 0
                      AND (COALESCE(vs.workday_visits, 0)::numeric / NULLIF(COALESCE(vs.total_visits, 0), 0)) < 0.6
                    )
               ) AS at_risk_mr_count
        FROM mr_scope ms
        LEFT JOIN user_schedule_preferences usp ON usp.user_id = ms.id
        LEFT JOIN visit_scope vs ON vs.user_id = ms.id
        LEFT JOIN overdue_reschedules orx ON orx.user_id = ms.id
        """;

    return jdbc.query(sql, params, rs -> {
      if (!rs.next()) {
        return new ManagerCoachingSummaryResponse(0, 0, 0, 0, 0, 0, 0);
      }
      return new ManagerCoachingSummaryResponse(
          rs.getLong("configured_schedule_count"),
          rs.getLong("total_mr_count"),
          rs.getDouble("schedule_coverage_rate"),
          rs.getDouble("workday_visit_rate"),
          rs.getDouble("plan_adherence_rate"),
          rs.getLong("overdue_reschedules"),
          rs.getLong("at_risk_mr_count")
      );
    });
  }

  private List<MrCoachingRowResponse> queryCoachingByMr(MapSqlParameterSource params) {
    String sql = """
        WITH mr_scope AS (
          SELECT DISTINCT u.id, u.full_name
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'MR'
            AND (CAST(:mrId AS UUID) IS NULL OR u.id = CAST(:mrId AS UUID))
            AND (
              CAST(:territoryId AS UUID) IS NULL OR EXISTS (
                SELECT 1
                FROM territory_assignments ta
                WHERE ta.user_id = u.id
                  AND ta.territory_id = CAST(:territoryId AS UUID)
                  AND ta.starts_on <= CURRENT_DATE
                  AND (ta.ends_on IS NULL OR ta.ends_on >= CURRENT_DATE)
              )
            )
        ),
        daily_visits AS (
          SELECT v.user_id,
                 DATE(v.visit_time AT TIME ZONE 'UTC') AS visit_day,
                 COUNT(*) AS daily_visits
          FROM visits v
          JOIN mr_scope ms ON ms.id = v.user_id
          WHERE (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
          GROUP BY v.user_id, DATE(v.visit_time AT TIME ZONE 'UTC')
        ),
        visit_stats AS (
          SELECT v.user_id,
                 COUNT(*) AS total_visits,
                 COUNT(*) FILTER (
                   WHERE usp.user_id IS NOT NULL
                     AND CAST(v.visit_time AT TIME ZONE 'UTC' AS time) BETWEEN usp.workday_start AND usp.workday_end
                     AND NOT (
                       usp.break_start IS NOT NULL
                       AND usp.break_end IS NOT NULL
                       AND CAST(v.visit_time AT TIME ZONE 'UTC' AS time) BETWEEN usp.break_start AND usp.break_end
                     )
                 ) AS workday_visits,
                 AVG(dv.daily_visits::numeric) AS avg_daily_visits
          FROM visits v
          JOIN mr_scope ms ON ms.id = v.user_id
          LEFT JOIN user_schedule_preferences usp ON usp.user_id = v.user_id
          JOIN daily_visits dv ON dv.user_id = v.user_id
            AND dv.visit_day = DATE(v.visit_time AT TIME ZONE 'UTC')
          WHERE (CAST(:fromTs AS TIMESTAMP) IS NULL OR v.visit_time >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR v.visit_time < CAST(:toTs AS TIMESTAMP))
          GROUP BY v.user_id
        ),
        overdue_reschedules AS (
          SELECT rf.created_by_user_id AS user_id, COUNT(*) AS overdue_count
          FROM recommendation_feedback rf
          JOIN recommendations r ON r.id = rf.recommendation_id
          JOIN doctors d ON d.id = r.doctor_id
          WHERE rf.status = 'RESCHEDULED'
            AND rf.rescheduled_to IS NOT NULL
            AND rf.rescheduled_to < CURRENT_TIMESTAMP
            AND (CAST(:mrId AS UUID) IS NULL OR rf.created_by_user_id = CAST(:mrId AS UUID))
            AND (CAST(:territoryId AS UUID) IS NULL OR d.territory_id = CAST(:territoryId AS UUID))
            AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR rf.created_at >= CAST(:fromTs AS TIMESTAMP))
            AND (CAST(:toTs AS TIMESTAMP) IS NULL OR rf.created_at < CAST(:toTs AS TIMESTAMP))
          GROUP BY rf.created_by_user_id
        )
        SELECT ms.id AS mr_id,
               ms.full_name AS mr_name,
               (usp.user_id IS NOT NULL) AS schedule_configured,
               COALESCE(usp.max_visits_per_day, 0) AS max_visits_per_day,
               COALESCE(vs.avg_daily_visits, 0) AS avg_visits_per_active_day,
               ROUND((COALESCE(vs.workday_visits, 0)::numeric / NULLIF(COALESCE(vs.total_visits, 0), 0)) * 100.0, 2) AS workday_visit_rate,
               COALESCE(orx.overdue_count, 0) AS overdue_reschedules
        FROM mr_scope ms
        LEFT JOIN user_schedule_preferences usp ON usp.user_id = ms.id
        LEFT JOIN visit_stats vs ON vs.user_id = ms.id
        LEFT JOIN overdue_reschedules orx ON orx.user_id = ms.id
        ORDER BY overdue_reschedules DESC, workday_visit_rate ASC NULLS FIRST, ms.full_name
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> {
      boolean scheduleConfigured = rs.getBoolean("schedule_configured");
      int maxVisitsPerDay = rs.getInt("max_visits_per_day");
      double avgVisitsPerActiveDay = rs.getDouble("avg_visits_per_active_day");
      double workdayVisitRate = rs.getObject("workday_visit_rate") == null ? 0.0 : rs.getDouble("workday_visit_rate");
      long overdueReschedules = rs.getLong("overdue_reschedules");
      String coachingFocus;
      if (!scheduleConfigured) {
        coachingFocus = "Set a day plan and work window";
      } else if (overdueReschedules > 0) {
        coachingFocus = "Clear overdue rescheduled recommendations";
      } else if (workdayVisitRate > 0 && workdayVisitRate < 60) {
        coachingFocus = "Shift visits into planned work windows";
      } else if (maxVisitsPerDay > 0 && avgVisitsPerActiveDay > maxVisitsPerDay) {
        coachingFocus = "Reduce overload against daily plan";
      } else {
        coachingFocus = "Maintain current field rhythm";
      }

      return new MrCoachingRowResponse(
          readUuid(rs, "mr_id"),
          rs.getString("mr_name"),
          scheduleConfigured,
          maxVisitsPerDay,
          avgVisitsPerActiveDay,
          workdayVisitRate,
          overdueReschedules,
          coachingFocus
      );
    });
  }

  private SalesTargetSummaryResponse querySalesTargetSummary(MapSqlParameterSource params) {
    String sql = """
        WITH target_scope AS (
          SELECT t.*
          FROM sr_weekly_targets t
          WHERE t.week_start = CAST(:weekStart AS DATE)
            AND (CAST(:territoryId AS UUID) IS NULL OR t.territory_id = CAST(:territoryId AS UUID))
        ),
        actual_scope AS (
          SELECT t.id,
                 COALESCE(SUM(poi.quantity), 0) AS actual_quantity,
                 COALESCE(SUM(poi.amount), 0) AS actual_amount
          FROM target_scope t
          LEFT JOIN pharmacy_orders po ON po.sales_rep_user_id = t.sales_rep_user_id
            AND (t.territory_id IS NULL OR po.territory_id = t.territory_id)
            AND po.ordered_at >= CAST(:weekStart AS DATE)
            AND po.ordered_at < CAST(:weekStart AS DATE) + INTERVAL '7 days'
          LEFT JOIN pharmacy_order_items poi ON poi.order_id = po.id
            AND poi.product_id = t.product_id
          GROUP BY t.id
        )
        SELECT COUNT(*) AS active_target_count,
               COALESCE(SUM(t.target_quantity), 0) AS target_quantity,
               COALESCE(SUM(a.actual_quantity), 0) AS actual_quantity,
               COALESCE(SUM(t.target_amount), 0) AS target_amount,
               COALESCE(SUM(a.actual_amount), 0) AS actual_amount,
               ROUND((COALESCE(SUM(a.actual_quantity), 0)::numeric / NULLIF(COALESCE(SUM(t.target_quantity), 0), 0)) * 100.0, 2) AS quantity_achievement_rate,
               ROUND((COALESCE(SUM(a.actual_amount), 0)::numeric / NULLIF(COALESCE(SUM(t.target_amount), 0), 0)) * 100.0, 2) AS amount_achievement_rate
        FROM target_scope t
        LEFT JOIN actual_scope a ON a.id = t.id
        """;

    return jdbc.query(sql, params, rs -> {
      if (!rs.next()) {
        return new SalesTargetSummaryResponse(0, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0);
      }
      return new SalesTargetSummaryResponse(
          rs.getInt("active_target_count"),
          rs.getLong("target_quantity"),
          rs.getLong("actual_quantity"),
          rs.getBigDecimal("target_amount"),
          rs.getBigDecimal("actual_amount"),
          rs.getObject("quantity_achievement_rate") == null ? 0.0 : rs.getDouble("quantity_achievement_rate"),
          rs.getObject("amount_achievement_rate") == null ? 0.0 : rs.getDouble("amount_achievement_rate")
      );
    });
  }

  private List<SalesRepTargetProgressResponse> querySalesTargetProgress(MapSqlParameterSource params) {
    String sql = """
        WITH target_scope AS (
          SELECT t.*,
                 u.full_name AS sales_rep_name,
                 p.name AS product_name,
                 tr.name AS territory_name
          FROM sr_weekly_targets t
          JOIN users u ON u.id = t.sales_rep_user_id
          JOIN products p ON p.id = t.product_id
          LEFT JOIN territories tr ON tr.id = t.territory_id
          WHERE t.week_start = CAST(:weekStart AS DATE)
            AND (CAST(:territoryId AS UUID) IS NULL OR t.territory_id = CAST(:territoryId AS UUID))
        )
        SELECT t.sales_rep_user_id,
               t.sales_rep_name,
               t.product_id,
               t.product_name,
               t.territory_id,
               t.territory_name,
               t.target_quantity,
               COALESCE(SUM(poi.quantity), 0) AS actual_quantity,
               t.target_amount,
               COALESCE(SUM(poi.amount), 0) AS actual_amount,
               ROUND((COALESCE(SUM(poi.quantity), 0)::numeric / NULLIF(t.target_quantity, 0)) * 100.0, 2) AS quantity_achievement_rate,
               ROUND((COALESCE(SUM(poi.amount), 0)::numeric / NULLIF(t.target_amount, 0)) * 100.0, 2) AS amount_achievement_rate
        FROM target_scope t
        LEFT JOIN pharmacy_orders po ON po.sales_rep_user_id = t.sales_rep_user_id
          AND (t.territory_id IS NULL OR po.territory_id = t.territory_id)
          AND po.ordered_at >= CAST(:weekStart AS DATE)
          AND po.ordered_at < CAST(:weekStart AS DATE) + INTERVAL '7 days'
        LEFT JOIN pharmacy_order_items poi ON poi.order_id = po.id
          AND poi.product_id = t.product_id
        GROUP BY t.sales_rep_user_id, t.sales_rep_name, t.product_id, t.product_name, t.territory_id, t.territory_name, t.target_quantity, t.target_amount
        ORDER BY quantity_achievement_rate ASC NULLS FIRST, t.sales_rep_name, t.product_name
        """;

    return jdbc.query(sql, params, (rs, rowNum) -> new SalesRepTargetProgressResponse(
        readUuid(rs, "sales_rep_user_id"),
        rs.getString("sales_rep_name"),
        readUuid(rs, "product_id"),
        rs.getString("product_name"),
        readUuid(rs, "territory_id"),
        rs.getString("territory_name"),
        rs.getInt("target_quantity"),
        rs.getLong("actual_quantity"),
        rs.getBigDecimal("target_amount"),
        rs.getBigDecimal("actual_amount"),
        rs.getObject("quantity_achievement_rate") == null ? 0.0 : rs.getDouble("quantity_achievement_rate"),
        rs.getObject("amount_achievement_rate") == null ? 0.0 : rs.getDouble("amount_achievement_rate")
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
