package com.example.nba.dto;

import java.util.List;

public record NbaNextResponse(
    List<NbaRecommendationResponse> recommendations
) {}