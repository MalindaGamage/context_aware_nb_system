package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record RecommendationLogResponse(
    UUID recommendationId,
    UUID userId,
    UUID doctorId,
    String doctorName,
    double score,
    String explanation,
    String recommendedAction,
    String recommendedMessage,
    UUID recommendedPharmacyId,
    String recommendedPharmacyName,
    OffsetDateTime createdAt,
    List<RecommendationFactorResponse> drivers,
    String latestFeedbackStatus,
    String latestFeedbackReason,
    UUID latestOverrideDoctorId
) {}
