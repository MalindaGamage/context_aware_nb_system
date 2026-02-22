package com.example.nba.service;

import com.example.nba.dto.DoctorResponse;
import com.example.nba.entity.Doctor;
import com.example.nba.repository.DoctorRepository;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.spec.DoctorSpecifications;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DoctorService {
  private final DoctorRepository doctorRepository;
  private final TerritoryAssignmentRepository territoryAssignmentRepository;
  private final TerritoryRepository territoryRepository;
  private final AuditLogService auditLogService;

  public DoctorService(DoctorRepository doctorRepository,
                       TerritoryAssignmentRepository territoryAssignmentRepository,
                       TerritoryRepository territoryRepository,
                       AuditLogService auditLogService) {
    this.doctorRepository = doctorRepository;
    this.territoryAssignmentRepository = territoryAssignmentRepository;
    this.territoryRepository = territoryRepository;
    this.auditLogService = auditLogService;
  }

  public Page<DoctorResponse> listDoctors(
      String tier,
      String specialty,
      UUID territoryId,
      UUID userId,
      boolean enforceAssignedTerritories,
      Pageable pageable) {
    String normalizedTier = normalizeFilter(tier);
    String normalizedSpecialty = normalizeFilter(specialty);
    List<UUID> allowedTerritories = resolveAllowedTerritories(userId, enforceAssignedTerritories);
    if (enforceAssignedTerritories && allowedTerritories.isEmpty()) {
      return Page.empty(pageable);
    }

    if (enforceAssignedTerritories && territoryId != null && !allowedTerritories.contains(territoryId)) {
      return Page.empty(pageable);
    }

    UUID effectiveTerritoryId = territoryId;
    if (enforceAssignedTerritories && territoryId == null && allowedTerritories.size() == 1) {
      effectiveTerritoryId = allowedTerritories.get(0);
    }

    Specification<Doctor> spec = Specification.where(DoctorSpecifications.hasTier(normalizedTier))
        .and(DoctorSpecifications.hasSpecialty(normalizedSpecialty))
        .and(DoctorSpecifications.hasTerritory(effectiveTerritoryId))
        .and(enforceAssignedTerritories && territoryId == null && allowedTerritories.size() != 1
            ? DoctorSpecifications.inTerritories(allowedTerritories)
            : null);

    return doctorRepository.findAll(spec, pageable)
        .map(this::toResponse);
  }

  public DoctorResponse getDoctor(UUID id, UUID userId, boolean enforceAssignedTerritories) {
    Doctor doctor = doctorRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Doctor not found"));

    if (enforceAssignedTerritories) {
      List<UUID> territories = resolveAllowedTerritories(userId, true);
      if (doctor.getTerritoryId() == null || !territories.contains(doctor.getTerritoryId())) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Doctor not found");
      }
    }
    return toResponse(doctor);
  }

  public List<DoctorResponse> findNearby(
      double lat,
      double lon,
      double radiusKm,
      int limit,
      UUID userId,
      boolean enforceAssignedTerritories) {
    double radiusMeters = radiusKm * 1000.0;
    List<Doctor> results;
    if (enforceAssignedTerritories) {
      List<UUID> territories = resolveAllowedTerritories(userId, true);
      if (territories.isEmpty()) {
        return List.of();
      }
      results = doctorRepository.findNearbyInTerritories(territories, lat, lon, radiusMeters, limit);
    } else {
      results = doctorRepository.findNearby(lat, lon, radiusMeters, limit);
    }

    return results
        .stream()
        .map(this::toResponse)
        .collect(Collectors.toList());
  }

  public void validateDoctorAccess(UUID doctorId, UUID userId, boolean enforceAssignedTerritories) {
    getDoctor(doctorId, userId, enforceAssignedTerritories);
  }

  public DoctorResponse assignTerritory(UUID doctorId, UUID territoryId, UUID actorUserId) {
    Doctor doctor = doctorRepository.findById(doctorId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Doctor not found"));

    UUID previousTerritoryId = doctor.getTerritoryId();
    if (territoryId != null && !territoryRepository.existsById(territoryId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Territory not found");
    }

    doctor.setTerritoryId(territoryId);
    doctorRepository.save(doctor);

    auditLogService.log(actorUserId, "DOCTOR_TERRITORY_ASSIGNED", "DOCTOR", doctor.getId(), Map.of(
        "previousTerritoryId", previousTerritoryId == null ? "" : previousTerritoryId.toString(),
        "newTerritoryId", territoryId == null ? "" : territoryId.toString()
    ));

    return toResponse(doctor);
  }

  private List<UUID> resolveAllowedTerritories(UUID userId, boolean enforceAssignedTerritories) {
    if (!enforceAssignedTerritories) {
      return List.of();
    }
    return territoryAssignmentRepository.findActiveTerritoryIdsByUserId(userId);
  }

  private DoctorResponse toResponse(Doctor doctor) {
    return new DoctorResponse(
        doctor.getId(),
        doctor.getFullName(),
        doctor.getSpecialty(),
        doctor.getTier(),
        doctor.getPriorityScore(),
        doctor.getTerritoryId(),
        doctor.getNotes(),
        doctor.getWhatsappNumber(),
        doctor.getEmail()
    );
  }

  private String normalizeFilter(String input) {
    if (input == null) {
      return null;
    }
    String trimmed = input.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
