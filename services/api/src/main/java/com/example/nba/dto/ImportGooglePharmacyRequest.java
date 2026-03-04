package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ImportGooglePharmacyRequest(
    @NotBlank String googlePlaceId,
    @NotBlank String name,
    @NotNull UUID territoryId,
    String address,
    String contactNumber,
    String notes,
    @NotNull Double lat,
    @NotNull Double lon
) {}
