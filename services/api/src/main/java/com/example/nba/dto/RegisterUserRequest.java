package com.example.nba.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterUserRequest(
    @NotBlank @Size(max = 120) String fullName,
    @Email @NotBlank @Size(max = 255) String email,
    @NotBlank @Size(min = 3, max = 80) String username,
    @NotBlank @Size(min = 8, max = 128) String password,
    @NotBlank @Pattern(regexp = "MR|SALES_REP|MANAGER") String role
) {}
