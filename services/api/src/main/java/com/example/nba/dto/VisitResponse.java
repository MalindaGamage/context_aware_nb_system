package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record VisitResponse(
    UUID id,
    UUID doctorId,
    UUID userId,
    OffsetDateTime visitTime,
    String outcome,
    String notes,
    boolean followUpRequired,
    boolean gpsCaptured,
    OffsetDateTime createdAt
) {}
