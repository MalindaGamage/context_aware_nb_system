package com.example.nba.controller;

import com.example.nba.dto.DoctorResponse;
import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.example.nba.service.DoctorService;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
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
      @RequestParam(defaultValue = "20") int size
  ) {
    Pageable pageable = PageRequest.of(page, size);
    Page<DoctorResponse> result = doctorService.listDoctors(tier, specialty, territoryId, pageable);
    PageMeta meta = new PageMeta(result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    return new PageResponse<>(result.getContent(), meta);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors/{id}")
  public DoctorResponse getDoctor(@PathVariable UUID id) {
    return doctorService.getDoctor(id);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/doctors/nearby")
  public List<DoctorResponse> nearbyDoctors(
      @RequestParam double lat,
      @RequestParam double lon,
      @RequestParam(defaultValue = "5") double radiusKm,
      @RequestParam(defaultValue = "20") int limit
  ) {
    return doctorService.findNearby(lat, lon, radiusKm, limit);
  }
}
