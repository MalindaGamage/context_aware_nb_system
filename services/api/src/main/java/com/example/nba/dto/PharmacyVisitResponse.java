package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PharmacyVisitResponse(
    UUID id,
    UUID pharmacyId,
    String pharmacyName,
    UUID userId,
    UUID territoryId,
    OffsetDateTime visitedAt,
    String outcome,
    String notes,
    String clientReferenceId,
    boolean gpsCaptured,
    OffsetDateTime createdAt
) {}
