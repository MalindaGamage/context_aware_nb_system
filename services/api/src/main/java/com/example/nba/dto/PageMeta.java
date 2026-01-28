package com.example.nba.dto;

public record PageMeta(
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
