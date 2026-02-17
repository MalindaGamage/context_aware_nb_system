package com.example.nba.service;

import com.example.nba.dto.AuditLogResponse;
import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditQueryService {
  private final NamedParameterJdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public AuditQueryService(NamedParameterJdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  public PageResponse<AuditLogResponse> list(UUID actorUserId,
                                             String action,
                                             String entityType,
                                             LocalDate from,
                                             LocalDate to,
                                             int page,
                                             int size) {
    int normalizedPage = Math.max(0, page);
    int normalizedSize = Math.max(1, Math.min(size, 100));
    int offset = normalizedPage * normalizedSize;

    Timestamp fromTs = from == null ? null : Timestamp.from(from.atStartOfDay().toInstant(ZoneOffset.UTC));
    Timestamp toTs = to == null ? null : Timestamp.from(to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));

    MapSqlParameterSource params = new MapSqlParameterSource()
        .addValue("actorUserId", actorUserId)
        .addValue("action", action == null ? null : action.trim())
        .addValue("entityType", entityType == null ? null : entityType.trim())
        .addValue("fromTs", fromTs)
        .addValue("toTs", toTs)
        .addValue("size", normalizedSize)
        .addValue("offset", offset);

    String baseWhere = """
        WHERE (:actorUserId IS NULL OR actor_user_id = :actorUserId)
          AND (:action IS NULL OR action = :action)
          AND (:entityType IS NULL OR entity_type = :entityType)
          AND (:fromTs IS NULL OR created_at >= :fromTs)
          AND (:toTs IS NULL OR created_at < :toTs)
        """;

    long total = jdbc.queryForObject(
        "SELECT COUNT(*) FROM audit_logs " + baseWhere,
        params,
        Long.class
    );

    List<AuditLogResponse> rows = jdbc.query(
        """
        SELECT id, actor_user_id, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs
        """ + baseWhere + """
        ORDER BY created_at DESC
        LIMIT :size OFFSET :offset
        """,
        params,
        (rs, rowNum) -> new AuditLogResponse(
            UUID.fromString(rs.getString("id")),
            rs.getObject("actor_user_id") == null ? null : UUID.fromString(rs.getString("actor_user_id")),
            rs.getString("action"),
            rs.getString("entity_type"),
            rs.getObject("entity_id") == null ? null : UUID.fromString(rs.getString("entity_id")),
            parseMetadata(rs.getString("metadata")),
            rs.getObject("created_at", OffsetDateTime.class)
        )
    );

    int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / normalizedSize);
    return new PageResponse<>(rows, new PageMeta(normalizedPage, normalizedSize, total, totalPages));
  }

  private JsonNode parseMetadata(String value) {
    try {
      return objectMapper.readTree(value == null ? "{}" : value);
    } catch (Exception ex) {
      return objectMapper.createObjectNode();
    }
  }
}
