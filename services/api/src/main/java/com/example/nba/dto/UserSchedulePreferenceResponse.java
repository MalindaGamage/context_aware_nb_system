package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserSchedulePreferenceResponse(
    UUID userId,
    String workdayStart,
    String workdayEnd,
    String breakStart,
    String breakEnd,
    Integer maxVisitsPerDay,
    String baseLocationText,
    String planningNotes,
    OffsetDateTime updatedAt
) {}
