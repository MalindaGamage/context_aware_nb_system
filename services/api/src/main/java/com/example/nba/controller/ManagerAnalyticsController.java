package com.example.nba.controller;

import com.example.nba.dto.ManagerAnalyticsResponse;
import com.example.nba.service.ManagerAnalyticsService;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ManagerAnalyticsController {
  private final ManagerAnalyticsService managerAnalyticsService;

  public ManagerAnalyticsController(ManagerAnalyticsService managerAnalyticsService) {
    this.managerAnalyticsService = managerAnalyticsService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/analytics/manager")
  public ManagerAnalyticsResponse managerAnalytics(
      @RequestParam(required = false) UUID mrId,
      @RequestParam(required = false) UUID territoryId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
  ) {
    return managerAnalyticsService.getDashboard(mrId, territoryId, from, to);
  }
}