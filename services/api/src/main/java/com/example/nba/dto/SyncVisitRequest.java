package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.UUID;

public record SyncVisitRequest(
    @NotBlank String clientReferenceId,
    @NotNull UUID doctorId,
    @NotNull OffsetDateTime visitTime,
    @NotBlank String outcome,
    String notes,
    boolean followUpRequired
) {}