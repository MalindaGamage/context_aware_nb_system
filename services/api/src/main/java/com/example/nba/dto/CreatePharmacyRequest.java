package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreatePharmacyRequest(
    @NotBlank String name,
    @NotBlank String code,
    UUID territoryId,
    String contactNumber,
    String notes,
    Double lat,
    Double lon
) {}
