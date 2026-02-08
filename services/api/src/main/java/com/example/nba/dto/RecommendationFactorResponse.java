package com.example.nba.dto;

public record RecommendationFactorResponse(
    String key,
    String value,
    double contribution
) {}