package com.example.nba.dto;

import java.util.List;

public record SyncBatchResponse(
    List<SyncItemResult> visitResults,
    List<SyncItemResult> feedbackResults,
    List<SyncConflict> conflicts
) {}