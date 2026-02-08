package com.example.nba.dto;

import java.util.List;
import java.util.UUID;

public record NbaRecommendationResponse(
    UUID recommendationId,
    UUID doctorId,
    String doctorName,
    String specialty,
    String tier,
    int priorityScore,
    double score,
    String explanation,
    List<RecommendationFactorResponse> drivers
) {}