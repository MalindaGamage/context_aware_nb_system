package com.example.nba.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.UUID;

public record RecommendationFeedbackRequest(
    @NotNull FeedbackStatus status,
    String reason,
    UUID overrideDoctorId,
    OffsetDateTime rescheduledTo,
    String overrideNotes,
    @NotBlank String clientReferenceId
) {}
