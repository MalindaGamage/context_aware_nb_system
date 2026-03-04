package com.example.nba.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreatePharmacyOrderRequest(
    @NotNull UUID pharmacyId,
    @NotNull OffsetDateTime orderedAt,
    String notes,
    String clientReferenceId,
    @Valid @NotEmpty List<PharmacyOrderItemRequest> items
) {}
