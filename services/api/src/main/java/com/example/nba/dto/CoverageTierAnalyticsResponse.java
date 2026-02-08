package com.example.nba.dto;

public record CoverageTierAnalyticsResponse(
    String tier,
    long doctorCount,
    long visitedDoctors,
    long totalVisits,
    double avgVisitsPerDoctor,
    Double avgDaysSinceLastVisit
) {}