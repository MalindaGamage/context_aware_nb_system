package com.example.nba.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record UpdateUserSchedulePreferenceRequest(
    @NotBlank String workdayStart,
    @NotBlank String workdayEnd,
    String breakStart,
    String breakEnd,
    @Min(1) @Max(20) Integer maxVisitsPerDay,
    String baseLocationText,
    String planningNotes
) {}
