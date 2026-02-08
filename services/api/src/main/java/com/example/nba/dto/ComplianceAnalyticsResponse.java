package com.example.nba.dto;

public record ComplianceAnalyticsResponse(
    long totalFeedback,
    long doneCount,
    long skippedCount,
    long rescheduledCount,
    long overrideCount,
    double doneRate,
    double overrideRate
) {}