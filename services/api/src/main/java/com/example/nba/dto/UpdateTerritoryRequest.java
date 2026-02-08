package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateTerritoryRequest(
    @NotBlank String name,
    @NotBlank String code
) {}
