package com.example.nba.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ScoringConfigResponse(
    UUID id,
    int version,
    String name,
    JsonNode weights,
    JsonNode messages,
    JsonNode segments,
    boolean active,
    UUID createdByUserId,
    OffsetDateTime createdAt
) {}
