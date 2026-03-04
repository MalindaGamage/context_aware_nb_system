package com.example.nba.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record UpsertSalesRepWeeklyTargetRequest(
    @NotNull UUID salesRepUserId,
    @NotNull UUID productId,
    UUID territoryId,
    @NotNull LocalDate weekStart,
    @Min(0) int targetQuantity,
    @NotNull BigDecimal targetAmount
) {}
