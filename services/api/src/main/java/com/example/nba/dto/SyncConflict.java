package com.example.nba.dto;

public record SyncConflict(
    String type,
    String clientReferenceId,
    String serverId,
    String reason
) {}