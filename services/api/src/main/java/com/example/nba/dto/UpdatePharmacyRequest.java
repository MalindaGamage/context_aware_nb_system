package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record UpdatePharmacyRequest(
    @NotBlank String name,
    @NotBlank String code,
    UUID territoryId,
    String contactNumber,
    String notes,
    Double lat,
    Double lon
) {}
