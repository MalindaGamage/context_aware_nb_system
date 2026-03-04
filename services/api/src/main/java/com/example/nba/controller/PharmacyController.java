package com.example.nba.controller;

import com.example.nba.dto.CreatePharmacyRequest;
import com.example.nba.dto.ImportGooglePharmacyRequest;
import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.example.nba.dto.PharmacyResponse;
import com.example.nba.dto.UpdatePharmacyRequest;
import com.example.nba.service.PharmacyService;
import jakarta.validation.Valid;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
public class PharmacyController {
  private final PharmacyService pharmacyService;

  public PharmacyController(PharmacyService pharmacyService) {
    this.pharmacyService = pharmacyService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_SALES_REP','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/pharmacies")
  public PageResponse<PharmacyResponse> list(@RequestParam(required = false) UUID territoryId,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size,
                                             @AuthenticationPrincipal Jwt jwt) {
    Pageable pageable = PageRequest.of(page, size);
    boolean fieldScoped = isMr(jwt) || isSalesRep(jwt);
    Page<PharmacyResponse> result = pharmacyService.listPharmacies(territoryId, UUID.fromString(jwt.getSubject()), fieldScoped, pageable);
    return new PageResponse<>(result.getContent(), new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_SALES_REP','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/pharmacies/nearby")
  public List<PharmacyResponse> nearby(@RequestParam double lat,
                                       @RequestParam double lon,
                                       @RequestParam(defaultValue = "5") double radiusKm,
                                       @RequestParam(defaultValue = "20") int limit,
                                       @AuthenticationPrincipal Jwt jwt) {
    boolean fieldScoped = isMr(jwt) || isSalesRep(jwt);
    return pharmacyService.findNearby(lat, lon, radiusKm, limit, UUID.fromString(jwt.getSubject()), fieldScoped);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/pharmacies")
  public PharmacyResponse create(@Valid @RequestBody CreatePharmacyRequest request, @AuthenticationPrincipal Jwt jwt) {
    return pharmacyService.create(request, UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/pharmacies/import-google")
  public PharmacyResponse importGoogle(@Valid @RequestBody ImportGooglePharmacyRequest request, @AuthenticationPrincipal Jwt jwt) {
    return pharmacyService.importFromGooglePlace(request, UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/pharmacies/{pharmacyId}")
  public PharmacyResponse update(@PathVariable UUID pharmacyId, @Valid @RequestBody UpdatePharmacyRequest request, @AuthenticationPrincipal Jwt jwt) {
    return pharmacyService.update(pharmacyId, request, UUID.fromString(jwt.getSubject()));
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
