package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record VisitResponse(
    UUID id,
    UUID doctorId,
    String doctorName,
    UUID userId,
    OffsetDateTime visitTime,
    String outcome,
    String notes,
    boolean followUpRequired,
    String clientReferenceId,
    boolean gpsCaptured,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}
