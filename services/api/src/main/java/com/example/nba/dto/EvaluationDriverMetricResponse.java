package com.example.nba.dto;

public record EvaluationDriverMetricResponse(
    String driverKey,
    long recommendationCount,
    double doneRate
) {}
