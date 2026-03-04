package com.example.nba.service;

import com.example.nba.dto.SalesRepWeeklyTargetResponse;
import com.example.nba.dto.UpsertSalesRepWeeklyTargetRequest;
import java.sql.Date;
import java.sql.Types;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalesTargetService {
  private final NamedParameterJdbcTemplate jdbc;

  public SalesTargetService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<SalesRepWeeklyTargetResponse> list(LocalDate weekStart) {
    String sql = """
        SELECT t.id,
               t.sales_rep_user_id,
               u.full_name AS sales_rep_name,
               t.product_id,
               p.name AS product_name,
               t.territory_id,
               tr.name AS territory_name,
               t.week_start,
               t.target_quantity,
               t.target_amount
        FROM sr_weekly_targets t
        JOIN users u ON u.id = t.sales_rep_user_id
        JOIN products p ON p.id = t.product_id
        LEFT JOIN territories tr ON tr.id = t.territory_id
        WHERE t.week_start = :weekStart
        ORDER BY u.full_name, p.name
        """;
    return jdbc.query(sql, new MapSqlParameterSource("weekStart", Date.valueOf(weekStart)), (rs, rowNum) ->
        new SalesRepWeeklyTargetResponse(
            UUID.fromString(rs.getString("id")),
            UUID.fromString(rs.getString("sales_rep_user_id")),
            rs.getString("sales_rep_name"),
            UUID.fromString(rs.getString("product_id")),
            rs.getString("product_name"),
            rs.getObject("territory_id") == null ? null : UUID.fromString(rs.getString("territory_id")),
            rs.getString("territory_name"),
            rs.getDate("week_start").toLocalDate(),
            rs.getInt("target_quantity"),
            rs.getBigDecimal("target_amount")
        ));
  }

  @Transactional
  public SalesRepWeeklyTargetResponse upsert(UpsertSalesRepWeeklyTargetRequest request, UUID actorUserId) {
    UUID existingId = jdbc.query("""
        SELECT id
        FROM sr_weekly_targets
        WHERE sales_rep_user_id = :salesRepUserId
          AND product_id = :productId
          AND ((territory_id IS NULL AND :territoryId IS NULL) OR territory_id = :territoryId)
          AND week_start = :weekStart
        """, params(request), rs -> rs.next() ? UUID.fromString(rs.getString("id")) : null);

    if (existingId == null) {
      existingId = UUID.randomUUID();
      jdbc.update("""
          INSERT INTO sr_weekly_targets (
            id, sales_rep_user_id, product_id, territory_id, week_start, target_quantity, target_amount, assigned_by_user_id, created_at, updated_at
          ) VALUES (
            :id, :salesRepUserId, :productId, :territoryId, :weekStart, :targetQuantity, :targetAmount, :assignedByUserId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          """, params(request)
          .addValue("id", existingId, Types.OTHER)
          .addValue("assignedByUserId", actorUserId, Types.OTHER));
    } else {
      jdbc.update("""
          UPDATE sr_weekly_targets
          SET target_quantity = :targetQuantity,
              target_amount = :targetAmount,
              updated_at = CURRENT_TIMESTAMP,
              assigned_by_user_id = :assignedByUserId
          WHERE id = :id
          """, params(request)
          .addValue("id", existingId, Types.OTHER)
          .addValue("assignedByUserId", actorUserId, Types.OTHER));
    }

    UUID responseId = existingId;
    return list(request.weekStart()).stream()
        .filter(item -> item.id().equals(responseId))
        .findFirst()
        .orElseThrow();
  }

  private MapSqlParameterSource params(UpsertSalesRepWeeklyTargetRequest request) {
    return new MapSqlParameterSource()
        .addValue("salesRepUserId", request.salesRepUserId(), Types.OTHER)
        .addValue("productId", request.productId(), Types.OTHER)
        .addValue("territoryId", request.territoryId(), Types.OTHER)
        .addValue("weekStart", Date.valueOf(request.weekStart()))
        .addValue("targetQuantity", request.targetQuantity())
        .addValue("targetAmount", request.targetAmount());
  }
}
