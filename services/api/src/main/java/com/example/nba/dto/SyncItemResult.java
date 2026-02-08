package com.example.nba.dto;

public record SyncItemResult(
    String clientReferenceId,
    String status,
    String serverId,
    String message
) {}