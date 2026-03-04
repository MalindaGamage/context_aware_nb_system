package com.example.nba.dto;

import java.util.UUID;

public record PharmacyResponse(
    UUID id,
    String name,
    String code,
    String googlePlaceId,
    String address,
    UUID territoryId,
    String contactNumber,
    String notes,
    Double lat,
    Double lon
) {}
