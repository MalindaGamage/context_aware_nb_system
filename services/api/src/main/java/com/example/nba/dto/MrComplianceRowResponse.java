package com.example.nba.dto;

import java.util.UUID;

public record MrComplianceRowResponse(
    UUID mrId,
    String mrName,
    long feedbackCount,
    double doneRate,
    double overrideRate,
    double skippedRate
) {}