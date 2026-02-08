package com.example.nba.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AuditLogService {
  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  public AuditLogService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
    this.jdbcTemplate = jdbcTemplate;
    this.objectMapper = objectMapper;
  }

  public void log(UUID actorUserId, String action, String entityType, UUID entityId, Map<String, Object> metadata) {
    jdbcTemplate.update(
        """
        INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), ?)
        """,
        UUID.randomUUID(),
        actorUserId,
        action,
        entityType,
        entityId,
        toJson(metadata),
        OffsetDateTime.now()
    );
  }

  private String toJson(Map<String, Object> metadata) {
    try {
      return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
    } catch (JsonProcessingException ex) {
      return "{}";
    }
  }
}
