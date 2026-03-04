package com.example.nba.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PharmacyOrderResponse(
    UUID orderId,
    UUID pharmacyId,
    String pharmacyName,
    UUID salesRepUserId,
    OffsetDateTime orderedAt,
    BigDecimal totalAmount,
    int totalQuantity,
    String notes
) {}
