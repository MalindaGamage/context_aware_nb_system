package com.example.nba.dto;

import java.util.UUID;

public record MrCoachingRowResponse(
    UUID mrId,
    String mrName,
    boolean scheduleConfigured,
    int maxVisitsPerDay,
    double avgVisitsPerActiveDay,
    double workdayVisitRate,
    long overdueReschedules,
    String coachingFocus
) {}
