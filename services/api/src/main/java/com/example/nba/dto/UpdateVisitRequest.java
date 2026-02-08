package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

public record UpdateVisitRequest(
    @NotNull OffsetDateTime visitTime,
    @NotBlank String outcome,
    String notes,
    boolean followUpRequired
) {}
