package com.example.nba.dto;

import java.util.List;
import java.util.UUID;

public record RecommenderItem(
    UUID doctor_id,
    double score,
    String explanation,
    List<RecommenderFactor> factors
) {}