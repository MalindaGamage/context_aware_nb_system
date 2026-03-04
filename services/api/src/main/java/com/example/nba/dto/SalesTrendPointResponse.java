package com.example.nba.dto;

import java.math.BigDecimal;

public record SalesTrendPointResponse(
    String bucket,
    long orderCount,
    long totalQuantity,
    BigDecimal totalAmount
) {}
