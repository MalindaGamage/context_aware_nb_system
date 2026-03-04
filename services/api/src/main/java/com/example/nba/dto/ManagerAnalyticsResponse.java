package com.example.nba.dto;

import java.util.List;

public record ManagerAnalyticsResponse(
    List<CoverageTierAnalyticsResponse> coverageByTier,
    List<MissedHighPriorityResponse> missedHighPriority,
    ComplianceAnalyticsResponse compliance,
    List<MrComplianceRowResponse> complianceByMr,
    ManagerCoachingSummaryResponse coachingSummary,
    List<MrCoachingRowResponse> coachingByMr,
    SalesTargetSummaryResponse salesTargetSummary,
    List<SalesRepTargetProgressResponse> salesTargetProgress
) {}
