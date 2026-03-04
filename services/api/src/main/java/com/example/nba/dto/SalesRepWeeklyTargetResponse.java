package com.example.nba.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SalesRepWeeklyTargetResponse(
    UUID id,
    UUID salesRepUserId,
    String salesRepName,
    UUID productId,
    String productName,
    UUID territoryId,
    String territoryName,
    LocalDate weekStart,
    int targetQuantity,
    BigDecimal targetAmount
) {}
