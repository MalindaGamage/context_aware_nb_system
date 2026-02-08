package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SyncFeedbackRequest(
    @NotBlank String clientReferenceId,
    @NotNull UUID recommendationId,
    @NotNull FeedbackStatus status,
    String reason,
    UUID overrideDoctorId,
    OffsetDateTime rescheduledTo,
    String overrideNotes
) {}