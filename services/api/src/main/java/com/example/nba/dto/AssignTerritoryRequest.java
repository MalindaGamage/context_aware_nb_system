package com.example.nba.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record AssignTerritoryRequest(
    @NotNull UUID territoryId,
    LocalDate startsOn
) {}
