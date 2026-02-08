package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTerritoryRequest(
    @NotBlank String name,
    @NotBlank String code
) {}
