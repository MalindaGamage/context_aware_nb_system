package com.example.nba.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateDoctorRequest(
    @NotBlank @Size(max = 255) String fullName,
    @Size(max = 128) String specialty,
    @NotBlank @Size(max = 16) String tier,
    @Min(0) @Max(100) int priorityScore,
    UUID territoryId,
    String notes,
    @Size(max = 32) String whatsappNumber,
    @Email @Size(max = 255) String email,
    @Size(max = 255) String targetProductFocus,
    @Size(max = 255) String availabilityPattern,
    @Size(max = 128) String availabilityWindow,
    String schedulingNotes,
    Double lat,
    Double lon
) {}
