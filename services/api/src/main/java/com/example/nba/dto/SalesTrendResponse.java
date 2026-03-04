package com.example.nba.dto;

import java.util.List;

public record SalesTrendResponse(
    List<SalesTrendPointResponse> series
) {}
