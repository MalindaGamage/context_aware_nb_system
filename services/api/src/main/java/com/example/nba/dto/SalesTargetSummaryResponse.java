package com.example.nba.dto;

import java.math.BigDecimal;

public record SalesTargetSummaryResponse(
    int activeTargetCount,
    long targetQuantity,
    long actualQuantity,
    BigDecimal targetAmount,
    BigDecimal actualAmount,
    double quantityAchievementRate,
    double amountAchievementRate
) {}
