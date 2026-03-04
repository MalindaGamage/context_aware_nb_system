package com.example.nba.dto;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreatePharmacyFeedbackRequest(
    @NotNull UUID pharmacyId,
    @NotNull UUID productId,
    UUID doctorId,
    @NotNull OffsetDateTime capturedAt,
    Boolean prescribed,
    Boolean stockAvailable,
    String notes
) {}
