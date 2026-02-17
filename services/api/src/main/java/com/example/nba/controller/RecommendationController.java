package com.example.nba.controller;

import com.example.nba.dto.NbaNextResponse;
import com.example.nba.service.RecommendationService;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RecommendationController {
  private static final Logger log = LoggerFactory.getLogger(RecommendationController.class);
  private final RecommendationService recommendationService;

  public RecommendationController(RecommendationService recommendationService) {
    this.recommendationService = recommendationService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/nba/next")
  public NbaNextResponse nextBestAction(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "5") int limit,
      HttpServletResponse response
  ) {
    long startNanos = System.nanoTime();
    int normalizedLimit = Math.max(1, Math.min(limit, 20));
    NbaNextResponse result = recommendationService.nextBestActions(UUID.fromString(jwt.getSubject()), normalizedLimit);
    long latencyMs = (System.nanoTime() - startNanos) / 1_000_000;
    response.setHeader("X-NBA-Latency-Ms", String.valueOf(latencyMs));
    if (latencyMs > 2000) {
      log.warn("NBA next exceeded target latency: {}ms for user {}", latencyMs, jwt.getSubject());
    } else {
      log.info("NBA next latency: {}ms for user {}", latencyMs, jwt.getSubject());
    }
    return result;
  }
}
