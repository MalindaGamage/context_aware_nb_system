package com.example.nba.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateUserRequest(
    @NotBlank String fullName,
    @Email @NotBlank String email,
    boolean active
) {}
