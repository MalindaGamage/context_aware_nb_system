package com.example.nba.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TerritoryOverviewResponse(
    UUID territoryId,
    String territoryName,
    String territoryCode,
    long assignedMrCount,
    long doctorCount,
    long visitCount,
    OffsetDateTime lastVisitTime
) {}
