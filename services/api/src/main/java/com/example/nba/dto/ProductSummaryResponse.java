package com.example.nba.dto;

import java.util.UUID;

public record ProductSummaryResponse(
    UUID id,
    String name,
    String category,
    boolean active,
    long assignedDoctors
) {}
