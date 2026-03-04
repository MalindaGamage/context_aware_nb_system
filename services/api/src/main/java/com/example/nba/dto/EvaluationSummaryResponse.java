package com.example.nba.dto;

import java.util.List;

public record EvaluationSummaryResponse(
    long totalRecommendations,
    long recommendationsWithFeedback,
    double feedbackCoverageRate,
    double doneRate,
    double skippedRate,
    double rescheduledRate,
    double overrideRate,
    double avgFeedbackLatencyHours,
    double visitFollowThroughRate,
    double avgScoreAccepted,
    double avgScoreSkipped,
    List<EvaluationDriverMetricResponse> topDriverEffectiveness
) {}
