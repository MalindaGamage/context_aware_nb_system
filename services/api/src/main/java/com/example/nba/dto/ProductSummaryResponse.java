package com.example.nba.dto;

import java.util.UUID;

public record ProductSummaryResponse(
    UUID id,
    String name,
    String code,
    String category,
    String brandName,
    String manufacturerType,
    boolean active,
    long assignedDoctors
) {}
