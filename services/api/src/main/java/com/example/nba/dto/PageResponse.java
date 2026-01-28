package com.example.nba.dto;

import java.util.List;

public record PageResponse<T>(
    List<T> content,
    PageMeta meta
) {}
