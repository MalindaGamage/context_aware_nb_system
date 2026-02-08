package com.example.nba.controller;

import com.example.nba.dto.RecommendationFeedbackRequest;
import com.example.nba.dto.RecommendationFeedbackResponse;
import com.example.nba.dto.SyncBatchRequest;
import com.example.nba.dto.SyncBatchResponse;
import com.example.nba.service.RecommendationFeedbackService;
import com.example.nba.service.SyncService;
import jakarta.validation.Valid;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {
  private final SyncService syncService;
  private final RecommendationFeedbackService feedbackService;

  public SyncController(SyncService syncService,
                        RecommendationFeedbackService feedbackService) {
    this.syncService = syncService;
    this.feedbackService = feedbackService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/sync/batch")
  public SyncBatchResponse syncBatch(@Valid @RequestBody SyncBatchRequest request,
                                     @AuthenticationPrincipal Jwt jwt) {
    UUID userId = UUID.fromString(jwt.getSubject());
    return syncService.syncBatch(userId, isMr(jwt), request);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/recommendations/{recommendationId}/feedback")
  public RecommendationFeedbackResponse submitFeedback(@PathVariable UUID recommendationId,
                                                       @Valid @RequestBody RecommendationFeedbackRequest request,
                                                       @AuthenticationPrincipal Jwt jwt) {
    UUID userId = UUID.fromString(jwt.getSubject());
    return feedbackService.submitFeedback(recommendationId, request, userId, isMr(jwt));
  }

  @SuppressWarnings("unchecked")
  private boolean isMr(Jwt jwt) {
    Object realmAccess = jwt.getClaim("realm_access");
    if (!(realmAccess instanceof Map<?, ?> map)) {
      return false;
    }
    Object roles = map.get("roles");
    if (!(roles instanceof Collection<?> collection)) {
      return false;
    }
    return collection.contains("MR");
  }
}