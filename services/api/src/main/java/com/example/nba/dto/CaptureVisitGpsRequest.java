package com.example.nba.dto;

import jakarta.validation.constraints.NotNull;

public record CaptureVisitGpsRequest(
    @NotNull Double lat,
    @NotNull Double lon,
    boolean optIn
) {}
