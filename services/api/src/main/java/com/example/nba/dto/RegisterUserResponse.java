package com.example.nba.dto;

import java.util.UUID;

public record RegisterUserResponse(
    UUID userId,
    String username,
    String email,
    String fullName,
    String role
) {}
