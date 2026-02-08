package com.example.nba.controller;

import com.example.nba.dto.NbaNextResponse;
import com.example.nba.service.RecommendationService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RecommendationController {
  private final RecommendationService recommendationService;

  public RecommendationController(RecommendationService recommendationService) {
    this.recommendationService = recommendationService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/nba/next")
  public NbaNextResponse nextBestAction(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "5") int limit
  ) {
    int normalizedLimit = Math.max(1, Math.min(limit, 20));
    return recommendationService.nextBestActions(UUID.fromString(jwt.getSubject()), normalizedLimit);
  }
}