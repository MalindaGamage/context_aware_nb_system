package com.example.nba.dto;

import java.util.List;
import java.util.UUID;

public record UserSummaryResponse(
    UUID id,
    String fullName,
    String email,
    List<TerritoryResponse> territories
) {}