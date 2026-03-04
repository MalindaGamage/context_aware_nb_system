package com.example.nba.dto;

import java.util.UUID;

public record DoctorResponse(
    UUID id,
    String fullName,
    String specialty,
    String tier,
    int priorityScore,
    UUID territoryId,
    String notes,
    String whatsappNumber,
    String email,
    String targetProductFocus,
    String availabilityPattern,
    String availabilityWindow,
    String schedulingNotes,
    Double lat,
    Double lon
) {}
