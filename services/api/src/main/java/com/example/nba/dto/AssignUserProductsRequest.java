package com.example.nba.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record AssignUserProductsRequest(
    @NotEmpty List<UUID> productIds
) {}
