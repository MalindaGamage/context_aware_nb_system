package com.example.nba.controller;

import com.example.nba.dto.SalesRepWeeklyTargetResponse;
import com.example.nba.dto.UpsertSalesRepWeeklyTargetRequest;
import com.example.nba.service.SalesTargetService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SalesTargetController {
  private final SalesTargetService salesTargetService;

  public SalesTargetController(SalesTargetService salesTargetService) {
    this.salesTargetService = salesTargetService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/sales-targets")
  public List<SalesRepWeeklyTargetResponse> list(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
  ) {
    LocalDate effectiveWeekStart = (weekStart != null ? weekStart : LocalDate.now()).with(java.time.DayOfWeek.MONDAY);
    return salesTargetService.list(effectiveWeekStart);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/sales-targets")
  public SalesRepWeeklyTargetResponse upsert(
      @Valid @RequestBody UpsertSalesRepWeeklyTargetRequest request,
      @AuthenticationPrincipal Jwt jwt
  ) {
    return salesTargetService.upsert(request, UUID.fromString(jwt.getSubject()));
  }
}
