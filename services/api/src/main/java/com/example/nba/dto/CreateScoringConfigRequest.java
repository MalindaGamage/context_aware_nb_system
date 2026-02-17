package com.example.nba.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateScoringConfigRequest(
    @NotBlank String name,
    @NotNull JsonNode weights,
    @NotNull JsonNode messages,
    @NotNull JsonNode segments,
    boolean activate
) {}
