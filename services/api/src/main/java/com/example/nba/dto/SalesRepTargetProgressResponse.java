package com.example.nba.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record SalesRepTargetProgressResponse(
    UUID salesRepUserId,
    String salesRepName,
    UUID productId,
    String productName,
    UUID territoryId,
    String territoryName,
    int targetQuantity,
    long actualQuantity,
    BigDecimal targetAmount,
    BigDecimal actualAmount,
    double quantityAchievementRate,
    double amountAchievementRate
) {}
