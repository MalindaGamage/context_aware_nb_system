package com.example.nba.dto;

public record RecommenderFactor(
    String key,
    String value,
    double contribution
) {}