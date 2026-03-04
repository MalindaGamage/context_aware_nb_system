package com.example.nba.dto;

import java.util.List;
import java.util.UUID;

public record RecommenderItem(
    UUID doctor_id,
    double score,
    String explanation,
    String recommended_action,
    String recommended_message,
    UUID recommended_pharmacy_id,
    String recommended_pharmacy_name,
    List<RecommenderFactor> factors
) {}
