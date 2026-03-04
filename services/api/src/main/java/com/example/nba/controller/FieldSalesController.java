package com.example.nba.controller;

import com.example.nba.dto.CreatePharmacyFeedbackRequest;
import com.example.nba.dto.CreatePharmacyOrderRequest;
import com.example.nba.dto.PharmacyFeedbackResponse;
import com.example.nba.dto.PharmacyOrderResponse;
import com.example.nba.dto.SalesTrendResponse;
import com.example.nba.service.PharmacySalesService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Map;
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
public class FieldSalesController {
  private final PharmacySalesService pharmacySalesService;

  public FieldSalesController(PharmacySalesService pharmacySalesService) {
    this.pharmacySalesService = pharmacySalesService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_SALES_REP','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/pharmacy-orders")
  public PharmacyOrderResponse createOrder(@Valid @RequestBody CreatePharmacyOrderRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
    return pharmacySalesService.createOrder(request, UUID.fromString(jwt.getSubject()), isSalesRep(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/pharmacy-feedback")
  public PharmacyFeedbackResponse captureFeedback(@Valid @RequestBody CreatePharmacyFeedbackRequest request,
                                                  @AuthenticationPrincipal Jwt jwt) {
    return pharmacySalesService.captureFeedback(request, UUID.fromString(jwt.getSubject()), isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/analytics/sales")
  public SalesTrendResponse salesTrend(@RequestParam(required = false) UUID productId,
                                       @RequestParam(required = false) UUID territoryId,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    return pharmacySalesService.salesTrend(productId, territoryId, from, to);
  }

  @SuppressWarnings("unchecked")
  private boolean isMr(Jwt jwt) {
    Object realmAccess = jwt.getClaim("realm_access");
    if (!(realmAccess instanceof Map<?, ?> map)) return false;
    Object roles = map.get("roles");
    return roles instanceof Collection<?> collection && collection.contains("MR");
  }

  @SuppressWarnings("unchecked")
  private boolean isSalesRep(Jwt jwt) {
    Object realmAccess = jwt.getClaim("realm_access");
    if (!(realmAccess instanceof Map<?, ?> map)) return false;
    Object roles = map.get("roles");
    return roles instanceof Collection<?> collection && collection.contains("SALES_REP");
  }
}
