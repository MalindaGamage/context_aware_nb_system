package com.example.nba.controller;

import com.example.nba.dto.AuditLogResponse;
import com.example.nba.dto.CreateScoringConfigRequest;
import com.example.nba.dto.PageResponse;
import com.example.nba.dto.ProductSummaryResponse;
import com.example.nba.dto.RecommendationLogResponse;
import com.example.nba.dto.ScoringConfigResponse;
import com.example.nba.service.AuditQueryService;
import com.example.nba.service.ProductService;
import com.example.nba.service.RecommendationLogService;
import com.example.nba.service.ScoringConfigService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminController {
  private final ScoringConfigService scoringConfigService;
  private final AuditQueryService auditQueryService;
  private final RecommendationLogService recommendationLogService;
  private final ProductService productService;

  public AdminController(ScoringConfigService scoringConfigService,
                         AuditQueryService auditQueryService,
                         RecommendationLogService recommendationLogService,
                         ProductService productService) {
    this.scoringConfigService = scoringConfigService;
    this.auditQueryService = auditQueryService;
    this.recommendationLogService = recommendationLogService;
    this.productService = productService;
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @GetMapping("/api/v1/admin/scoring-configs")
  public List<ScoringConfigResponse> listScoringConfigs() {
    return scoringConfigService.listVersions();
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @GetMapping("/api/v1/admin/scoring-configs/active")
  public ScoringConfigResponse activeScoringConfig() {
    return scoringConfigService.getActive();
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PostMapping("/api/v1/admin/scoring-configs")
  public ScoringConfigResponse createScoringConfig(@Valid @RequestBody CreateScoringConfigRequest request,
                                                   @AuthenticationPrincipal Jwt jwt) {
    return scoringConfigService.createVersion(request, UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PostMapping("/api/v1/admin/scoring-configs/{configId}/activate")
  public ScoringConfigResponse activateScoringConfig(@PathVariable UUID configId,
                                                     @AuthenticationPrincipal Jwt jwt) {
    return scoringConfigService.activate(configId, UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @GetMapping("/api/v1/admin/audit-logs")
  public PageResponse<AuditLogResponse> auditLogs(
      @RequestParam(required = false) UUID actorUserId,
      @RequestParam(required = false) String action,
      @RequestParam(required = false) String entityType,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return auditQueryService.list(actorUserId, action, entityType, from, to, page, size);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/admin/recommendation-logs")
  public PageResponse<RecommendationLogResponse> recommendationLogs(
      @RequestParam(required = false) UUID userId,
      @RequestParam(required = false) UUID doctorId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size
  ) {
    return recommendationLogService.list(userId, doctorId, page, size);
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @GetMapping("/api/v1/admin/products")
  public List<ProductSummaryResponse> products() {
    return productService.listProducts();
  }
}
