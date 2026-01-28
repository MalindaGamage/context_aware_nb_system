package com.example.nba.dto;

import java.util.UUID;

public record TerritoryResponse(
    UUID id,
    String name,
    String code
) {}