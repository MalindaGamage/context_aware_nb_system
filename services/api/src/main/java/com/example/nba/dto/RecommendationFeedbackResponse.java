package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RecommendationFeedbackResponse(
    UUID id,
    UUID recommendationId,
    String status,
    String reason,
    UUID overrideDoctorId,
    OffsetDateTime rescheduledTo,
    String overrideNotes,
    String clientReferenceId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {}