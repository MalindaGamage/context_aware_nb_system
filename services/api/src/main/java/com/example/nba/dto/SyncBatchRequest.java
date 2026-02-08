package com.example.nba.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record SyncBatchRequest(
    @NotNull SyncConflictStrategy strategy,
    @Valid List<SyncVisitRequest> visits,
    @Valid List<SyncFeedbackRequest> feedback
) {}