package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PharmacyFeedbackResponse(
    UUID id,
    UUID pharmacyId,
    UUID productId,
    UUID mrUserId,
    UUID doctorId,
    OffsetDateTime capturedAt,
    Boolean prescribed,
    Boolean stockAvailable,
    String notes
) {}
