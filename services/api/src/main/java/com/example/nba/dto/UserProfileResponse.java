package com.example.nba.dto;

import java.util.List;
import java.util.UUID;

public record UserProfileResponse(
    UUID id,
    String fullName,
    String email,
    boolean active,
    String role,
    List<TerritoryResponse> territories
) {}
