package com.example.nba.dto;

public record ManagerCoachingSummaryResponse(
    long configuredScheduleCount,
    long totalMrCount,
    double scheduleCoverageRate,
    double workdayVisitRate,
    double planAdherenceRate,
    long overdueReschedules,
    long atRiskMrCount
) {}
