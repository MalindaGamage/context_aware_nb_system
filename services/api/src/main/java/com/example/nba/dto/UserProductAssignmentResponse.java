package com.example.nba.dto;

import java.time.LocalDate;
import java.util.UUID;

public record UserProductAssignmentResponse(
    UUID productId,
    String productName,
    String productCode,
    String brandName,
    String manufacturerType,
    boolean active,
    LocalDate startsOn,
    LocalDate endsOn
) {}
