package com.example.nba.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProductRequest(
    @NotBlank @Size(max = 255) String name,
    @NotBlank @Size(max = 64) String code,
    @Size(max = 1000) String description,
    @Size(max = 255) String brandName,
    @Size(max = 64) String manufacturerType,
    boolean active
) {}
