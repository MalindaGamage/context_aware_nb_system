package com.example.nba.controller;

import com.example.nba.dto.DoctorResponse;
import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.example.nba.service.DoctorService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DoctorController {
  private final DoctorService doctorService;

  public DoctorController(DoctorService doctorService) {
    this.doctorService = doctorService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors")
  public PageResponse<DoctorResponse> listDoctors(
      @RequestParam(required = false) String tier,
      @RequestParam(required = false) String specialty,
      @RequestParam(required = false) UUID territoryId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @AuthenticationPrincipal Jwt jwt
  ) {
    Pageable pageable = PageRequest.of(page, size);
    UUID userId = UUID.fromString(jwt.getSubject());
    Page<DoctorResponse> result = doctorService.listDoctors(
        tier,
        specialty,
        territoryId,
        userId,
        isMr(jwt),
        pageable
    );
    PageMeta meta = new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    return new PageResponse<>(result.getContent(), meta);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors/{id}")
  public DoctorResponse getDoctor(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
    return doctorService.getDoctor(id, UUID.fromString(jwt.getSubject()), isMr(jwt));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors/nearby")
  public List<DoctorResponse> nearbyDoctors(
      @RequestParam double lat,
      @RequestParam double lon,
      @RequestParam(defaultValue = "5") double radiusKm,
      @RequestParam(defaultValue = "20") int limit,
      @AuthenticationPrincipal Jwt jwt
  ) {
    return doctorService.findNearby(
        lat,
        lon,
        radiusKm,
        limit,
        UUID.fromString(jwt.getSubject()),
        isMr(jwt)
    );
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
