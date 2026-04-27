package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreatePharmacyVisitRequest(
    @NotNull UUID pharmacyId,
    @NotNull OffsetDateTime visitedAt,
    @NotBlank String outcome,
    String notes,
    String clientReferenceId,
    Double lat,
    Double lon
) {}
