package com.example.nba.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID actorUserId,
    String action,
    String entityType,
    UUID entityId,
    JsonNode metadata,
    OffsetDateTime createdAt
) {}
