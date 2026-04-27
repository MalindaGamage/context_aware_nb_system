package com.example.nba.service;

import com.example.nba.dto.CreatePharmacyFeedbackRequest;
import com.example.nba.dto.CreatePharmacyOrderRequest;
import com.example.nba.dto.CreatePharmacyVisitRequest;
import com.example.nba.dto.PharmacyFeedbackResponse;
import com.example.nba.dto.PharmacyOrderResponse;
import com.example.nba.dto.PharmacyVisitResponse;
import com.example.nba.dto.SalesTrendPointResponse;
import com.example.nba.dto.SalesTrendResponse;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PharmacySalesService {
  private static final int MAX_OUTCOME_LENGTH = 120;
  private static final int MAX_NOTES_LENGTH = 2000;

  private final NamedParameterJdbcTemplate jdbc;
  private final PharmacyService pharmacyService;
  private final DoctorService doctorService;
  private final AuditLogService auditLogService;

  public PharmacySalesService(NamedParameterJdbcTemplate jdbc,
                              PharmacyService pharmacyService,
                              DoctorService doctorService,
                              AuditLogService auditLogService) {
    this.jdbc = jdbc;
    this.pharmacyService = pharmacyService;
    this.doctorService = doctorService;
    this.auditLogService = auditLogService;
  }

  @Transactional
  public PharmacyOrderResponse createOrder(CreatePharmacyOrderRequest request, UUID actorUserId, boolean enforceRepScope) {
    var pharmacy = pharmacyService.validateAccess(request.pharmacyId(), actorUserId, enforceRepScope);
    String clientReferenceId = normalizeClientReference(request.clientReferenceId());
    if (clientReferenceId != null) {
      List<PharmacyOrderResponse> existing = jdbc.query("""
          SELECT po.id AS order_id,
                 po.pharmacy_id,
                 ph.name AS pharmacy_name,
                 po.sales_rep_user_id,
                 po.ordered_at,
                 COALESCE(SUM(poi.amount), 0) AS total_amount,
                 COALESCE(SUM(poi.quantity), 0) AS total_quantity,
                 po.notes
          FROM pharmacy_orders po
          JOIN pharmacies ph ON ph.id = po.pharmacy_id
          LEFT JOIN pharmacy_order_items poi ON poi.order_id = po.id
          WHERE po.sales_rep_user_id = :userId
            AND po.client_reference_id = :clientReferenceId
          GROUP BY po.id, po.pharmacy_id, ph.name, po.sales_rep_user_id, po.ordered_at, po.notes
          """, new MapSqlParameterSource()
          .addValue("userId", actorUserId, Types.OTHER)
          .addValue("clientReferenceId", clientReferenceId), (rs, rowNum) ->
              new PharmacyOrderResponse(
                  UUID.fromString(rs.getString("order_id")),
                  UUID.fromString(rs.getString("pharmacy_id")),
                  rs.getString("pharmacy_name"),
                  UUID.fromString(rs.getString("sales_rep_user_id")),
                  rs.getTimestamp("ordered_at").toInstant().atOffset(ZoneOffset.UTC),
                  rs.getBigDecimal("total_amount"),
                  rs.getInt("total_quantity"),
                  rs.getString("notes")
              ));
      if (!existing.isEmpty()) {
        return existing.get(0);
      }
    }

    UUID orderId = UUID.randomUUID();
    MapSqlParameterSource orderParams = new MapSqlParameterSource()
        .addValue("id", orderId, Types.OTHER)
        .addValue("pharmacyId", request.pharmacyId(), Types.OTHER)
        .addValue("salesRepUserId", actorUserId, Types.OTHER)
        .addValue("territoryId", pharmacy.territoryId(), Types.OTHER)
        .addValue("orderedAt", Timestamp.from(request.orderedAt().toInstant()))
        .addValue("notes", trimToNull(request.notes()))
        .addValue("clientReferenceId", clientReferenceId);
    jdbc.update("""
        INSERT INTO pharmacy_orders (id, pharmacy_id, sales_rep_user_id, territory_id, ordered_at, notes, client_reference_id, created_at)
        VALUES (:id, :pharmacyId, :salesRepUserId, :territoryId, :orderedAt, :notes, :clientReferenceId, CURRENT_TIMESTAMP)
        """, orderParams);

    int totalQuantity = 0;
    BigDecimal totalAmount = BigDecimal.ZERO;
    for (var item : request.items()) {
      totalQuantity += item.quantity();
      totalAmount = totalAmount.add(item.amount());
      jdbc.update("""
          INSERT INTO pharmacy_order_items (id, order_id, product_id, quantity, amount)
          VALUES (:id, :orderId, :productId, :quantity, :amount)
          """, new MapSqlParameterSource()
          .addValue("id", UUID.randomUUID(), Types.OTHER)
          .addValue("orderId", orderId, Types.OTHER)
          .addValue("productId", item.productId(), Types.OTHER)
          .addValue("quantity", item.quantity())
          .addValue("amount", item.amount()));
    }

    auditLogService.log(actorUserId, "PHARMACY_ORDER_CAPTURED", "PHARMACY_ORDER", orderId, java.util.Map.of(
        "pharmacyId", request.pharmacyId().toString(),
        "totalQuantity", totalQuantity,
        "totalAmount", totalAmount.toPlainString()
    ));

    return new PharmacyOrderResponse(orderId, request.pharmacyId(), pharmacy.name(), actorUserId, request.orderedAt(), totalAmount, totalQuantity, trimToNull(request.notes()));
  }

  @Transactional
  public PharmacyFeedbackResponse captureFeedback(CreatePharmacyFeedbackRequest request, UUID actorUserId, boolean enforceMrScope) {
    pharmacyService.validateAccess(request.pharmacyId(), actorUserId, enforceMrScope);
    if (request.doctorId() != null) {
      doctorService.validateDoctorAccess(request.doctorId(), actorUserId, enforceMrScope);
    }
    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO pharmacy_feedback (id, pharmacy_id, product_id, mr_user_id, doctor_id, captured_at, prescribed, stock_available, notes, created_at)
        VALUES (:id, :pharmacyId, :productId, :mrUserId, :doctorId, :capturedAt, :prescribed, :stockAvailable, :notes, CURRENT_TIMESTAMP)
        """, new MapSqlParameterSource()
        .addValue("id", id, Types.OTHER)
        .addValue("pharmacyId", request.pharmacyId(), Types.OTHER)
        .addValue("productId", request.productId(), Types.OTHER)
        .addValue("mrUserId", actorUserId, Types.OTHER)
        .addValue("doctorId", request.doctorId(), Types.OTHER)
        .addValue("capturedAt", Timestamp.from(request.capturedAt().toInstant()))
        .addValue("prescribed", request.prescribed())
        .addValue("stockAvailable", request.stockAvailable())
        .addValue("notes", trimToNull(request.notes())));

    auditLogService.log(actorUserId, "PHARMACY_FEEDBACK_CAPTURED", "PHARMACY_FEEDBACK", id, java.util.Map.of(
        "pharmacyId", request.pharmacyId().toString(),
        "productId", request.productId().toString()
    ));

    return new PharmacyFeedbackResponse(id, request.pharmacyId(), request.productId(), actorUserId, request.doctorId(), request.capturedAt(), request.prescribed(), request.stockAvailable(), trimToNull(request.notes()));
  }

  @Transactional
  public PharmacyVisitResponse createVisit(CreatePharmacyVisitRequest request, UUID actorUserId, boolean enforceFieldScope) {
    var pharmacy = pharmacyService.validateAccess(request.pharmacyId(), actorUserId, enforceFieldScope);
    String clientReferenceId = normalizeClientReference(request.clientReferenceId());
    if (clientReferenceId != null) {
      List<PharmacyVisitResponse> existing = jdbc.query("""
          SELECT pv.id, pv.pharmacy_id, ph.name AS pharmacy_name, pv.user_id, pv.territory_id,
                 pv.visited_at, pv.outcome, pv.notes, pv.client_reference_id,
                 pv.location IS NOT NULL AS gps_captured, pv.created_at
          FROM pharmacy_visits pv
          JOIN pharmacies ph ON ph.id = pv.pharmacy_id
          WHERE pv.user_id = :userId AND pv.client_reference_id = :clientReferenceId
          """, new MapSqlParameterSource()
          .addValue("userId", actorUserId, Types.OTHER)
          .addValue("clientReferenceId", clientReferenceId), (rs, rowNum) -> toVisitResponse(rs));
      if (!existing.isEmpty()) return existing.get(0);
    }

    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO pharmacy_visits (
          id, pharmacy_id, user_id, territory_id, visited_at, outcome, notes, location,
          client_reference_id, created_at, updated_at
        )
        VALUES (
          :id, :pharmacyId, :userId, :territoryId, :visitedAt, :outcome, :notes,
          CASE
            WHEN CAST(:lat AS DOUBLE PRECISION) IS NULL THEN NULL
            ELSE ST_SetSRID(ST_MakePoint(CAST(:lon AS DOUBLE PRECISION), CAST(:lat AS DOUBLE PRECISION)), 4326)
          END,
          :clientReferenceId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        """, new MapSqlParameterSource()
        .addValue("id", id, Types.OTHER)
        .addValue("pharmacyId", request.pharmacyId(), Types.OTHER)
        .addValue("userId", actorUserId, Types.OTHER)
        .addValue("territoryId", pharmacy.territoryId(), Types.OTHER)
        .addValue("visitedAt", Timestamp.from(validateVisitTime(request.visitedAt()).toInstant()), Types.TIMESTAMP)
        .addValue("outcome", normalizeOutcome(request.outcome()))
        .addValue("notes", normalizeNotes(request.notes()))
        .addValue("lat", validateLatitude(request.lat(), request.lon()), Types.DOUBLE)
        .addValue("lon", validateLongitude(request.lat(), request.lon()), Types.DOUBLE)
        .addValue("clientReferenceId", clientReferenceId));

    auditLogService.log(actorUserId, "PHARMACY_VISIT_CREATED", "PHARMACY_VISIT", id, java.util.Map.of(
        "pharmacyId", request.pharmacyId().toString(),
        "outcome", normalizeOutcome(request.outcome())
    ));

    return jdbc.queryForObject("""
        SELECT pv.id, pv.pharmacy_id, ph.name AS pharmacy_name, pv.user_id, pv.territory_id,
               pv.visited_at, pv.outcome, pv.notes, pv.client_reference_id,
               pv.location IS NOT NULL AS gps_captured, pv.created_at
        FROM pharmacy_visits pv
        JOIN pharmacies ph ON ph.id = pv.pharmacy_id
        WHERE pv.id = :id
        """, new MapSqlParameterSource().addValue("id", id, Types.OTHER), (rs, rowNum) -> toVisitResponse(rs));
  }

  public SalesTrendResponse salesTrend(UUID productId, UUID territoryId, LocalDate from, LocalDate to) {
    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
    String sql = """
        SELECT TO_CHAR(DATE_TRUNC('day', po.ordered_at), 'YYYY-MM-DD') AS bucket,
               COUNT(DISTINCT po.id) AS order_count,
               COALESCE(SUM(poi.quantity), 0) AS total_quantity,
               COALESCE(SUM(poi.amount), 0) AS total_amount
        FROM pharmacy_orders po
        JOIN pharmacy_order_items poi ON poi.order_id = po.id
        WHERE (CAST(:productId AS UUID) IS NULL OR poi.product_id = CAST(:productId AS UUID))
          AND (CAST(:territoryId AS UUID) IS NULL OR po.territory_id = CAST(:territoryId AS UUID))
          AND (CAST(:fromTs AS TIMESTAMP) IS NULL OR po.ordered_at >= CAST(:fromTs AS TIMESTAMP))
          AND (CAST(:toTs AS TIMESTAMP) IS NULL OR po.ordered_at < CAST(:toTs AS TIMESTAMP))
        GROUP BY DATE_TRUNC('day', po.ordered_at)
        ORDER BY DATE_TRUNC('day', po.ordered_at)
        """;
    List<SalesTrendPointResponse> series = jdbc.query(sql, new MapSqlParameterSource()
        .addValue("productId", productId, Types.OTHER)
        .addValue("territoryId", territoryId, Types.OTHER)
        .addValue("fromTs", fromTs, Types.TIMESTAMP)
        .addValue("toTs", toTs, Types.TIMESTAMP), (rs, rowNum) ->
            new SalesTrendPointResponse(
                rs.getString("bucket"),
                rs.getLong("order_count"),
                rs.getLong("total_quantity"),
                rs.getBigDecimal("total_amount")
            ));
    return new SalesTrendResponse(series);
  }

  private String normalizeClientReference(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String trimToNull(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String normalizeOutcome(String outcome) {
    String trimmed = outcome.trim();
    if (trimmed.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outcome is required");
    }
    if (trimmed.length() > MAX_OUTCOME_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outcome length must be <= " + MAX_OUTCOME_LENGTH);
    }
    return trimmed;
  }

  private String normalizeNotes(String notes) {
    String trimmed = trimToNull(notes);
    if (trimmed != null && trimmed.length() > MAX_NOTES_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes length must be <= " + MAX_NOTES_LENGTH);
    }
    return trimmed;
  }

  private OffsetDateTime validateVisitTime(OffsetDateTime visitTime) {
    OffsetDateTime now = OffsetDateTime.now();
    if (visitTime.isAfter(now.plusMinutes(5))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visit time cannot be in the future");
    }
    if (visitTime.isBefore(now.minusYears(2))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visit time is too old");
    }
    return visitTime;
  }

  private Double validateLatitude(Double lat, Double lon) {
    if (lat == null && lon == null) return null;
    if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid latitude/longitude");
    }
    return lat;
  }

  private Double validateLongitude(Double lat, Double lon) {
    validateLatitude(lat, lon);
    return lon;
  }

  private PharmacyVisitResponse toVisitResponse(java.sql.ResultSet rs) throws java.sql.SQLException {
    return new PharmacyVisitResponse(
        UUID.fromString(rs.getString("id")),
        UUID.fromString(rs.getString("pharmacy_id")),
        rs.getString("pharmacy_name"),
        UUID.fromString(rs.getString("user_id")),
        rs.getString("territory_id") == null ? null : UUID.fromString(rs.getString("territory_id")),
        rs.getTimestamp("visited_at").toInstant().atOffset(ZoneOffset.UTC),
        rs.getString("outcome"),
        rs.getString("notes"),
        rs.getString("client_reference_id"),
        rs.getBoolean("gps_captured"),
        rs.getTimestamp("created_at").toInstant().atOffset(ZoneOffset.UTC)
    );
  }
}
