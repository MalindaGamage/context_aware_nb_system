package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MissedHighPriorityResponse(
    UUID doctorId,
    String doctorName,
    String tier,
    int priorityScore,
    String territoryName,
    OffsetDateTime lastVisitTime
) {}