package com.example.nba.controller;

import com.example.nba.dto.CaptureVisitGpsRequest;
import com.example.nba.dto.CreateVisitRequest;
import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.example.nba.dto.UpdateVisitRequest;
import com.example.nba.dto.VisitResponse;
import com.example.nba.service.VisitService;
import jakarta.validation.Valid;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class VisitController {
  private final VisitService visitService;

  public VisitController(VisitService visitService) {
    this.visitService = visitService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/visits")
  public VisitResponse createVisit(@Valid @RequestBody CreateVisitRequest request, @AuthenticationPrincipal Jwt jwt) {
    UUID actorUserId = UUID.fromString(jwt.getSubject());
    return visitService.createVisit(request, actorUserId, isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/visits")
  public PageResponse<VisitResponse> listMyVisits(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Pageable pageable = PageRequest.of(page, size);
    Page<VisitResponse> result = visitService.listMyVisits(UUID.fromString(jwt.getSubject()), pageable);
    return new PageResponse<>(
        result.getContent(),
        new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/visits/{visitId}")
  public VisitResponse getVisit(@PathVariable UUID visitId, @AuthenticationPrincipal Jwt jwt) {
    return visitService.getVisit(visitId, UUID.fromString(jwt.getSubject()), isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/visits/{visitId}")
  public VisitResponse updateVisit(@PathVariable UUID visitId,
                                   @Valid @RequestBody UpdateVisitRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
    return visitService.updateVisit(visitId, request, UUID.fromString(jwt.getSubject()), isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/visits/{visitId}/gps")
  public VisitResponse captureGps(@PathVariable UUID visitId,
                                  @Valid @RequestBody CaptureVisitGpsRequest request,
                                  @AuthenticationPrincipal Jwt jwt) {
    return visitService.captureGps(visitId, request, UUID.fromString(jwt.getSubject()), isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors/{doctorId}/visits")
  public PageResponse<VisitResponse> listDoctorVisits(@PathVariable UUID doctorId,
                                                      @AuthenticationPrincipal Jwt jwt,
                                                      @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "20") int size) {
    Pageable pageable = PageRequest.of(page, size);
    Page<VisitResponse> result = visitService.listDoctorVisits(
        doctorId,
        UUID.fromString(jwt.getSubject()),
        isMr(jwt),
        pageable);
    return new PageResponse<>(
        result.getContent(),
        new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()));
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
