package com.example.nba.service;

import com.example.nba.dto.DoctorResponse;
import com.example.nba.dto.CreateDoctorRequest;
import com.example.nba.dto.UpdateDoctorRequest;
import com.example.nba.entity.Doctor;
import com.example.nba.repository.DoctorRepository;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.spec.DoctorSpecifications;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DoctorService {
  private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

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
      Integer minPriorityScore,
      Integer maxPriorityScore,
      UUID territoryId,
      UUID userId,
      boolean enforceAssignedTerritories,
      Pageable pageable) {
    String normalizedTier = normalizeFilter(tier);
    String normalizedSpecialty = normalizeFilter(specialty);
    Integer normalizedMinPriority = normalizePriority(minPriorityScore);
    Integer normalizedMaxPriority = normalizePriority(maxPriorityScore);
    if (normalizedMinPriority != null && normalizedMaxPriority != null && normalizedMinPriority > normalizedMaxPriority) {
      return Page.empty(pageable);
    }

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
        .and(DoctorSpecifications.hasPriorityAtLeast(normalizedMinPriority))
        .and(DoctorSpecifications.hasPriorityAtMost(normalizedMaxPriority))
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

  public DoctorResponse createDoctor(CreateDoctorRequest request, UUID actorUserId) {
    validateCoordinates(request.lat(), request.lon());
    validateTerritoryExists(request.territoryId());

    Doctor doctor = new Doctor();
    OffsetDateTime now = OffsetDateTime.now();
    doctor.setId(UUID.randomUUID());
    applyDoctorAttributes(
        doctor,
        request.fullName(),
        request.specialty(),
        request.tier(),
        request.priorityScore(),
        request.territoryId(),
        request.notes(),
        request.whatsappNumber(),
        request.email(),
        request.lat(),
        request.lon()
    );
    doctor.setCreatedAt(now);
    doctor.setUpdatedAt(now);
    doctorRepository.save(doctor);

    auditLogService.log(actorUserId, "DOCTOR_CREATED", "DOCTOR", doctor.getId(), Map.of(
        "fullName", doctor.getFullName(),
        "territoryId", doctor.getTerritoryId() == null ? "" : doctor.getTerritoryId().toString(),
        "tier", doctor.getTier()
    ));
    return toResponse(doctor);
  }

  public DoctorResponse updateDoctor(UUID doctorId, UpdateDoctorRequest request, UUID actorUserId) {
    validateCoordinates(request.lat(), request.lon());
    validateTerritoryExists(request.territoryId());

    Doctor doctor = doctorRepository.findById(doctorId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Doctor not found"));

    UUID previousTerritoryId = doctor.getTerritoryId();
    applyDoctorAttributes(
        doctor,
        request.fullName(),
        request.specialty(),
        request.tier(),
        request.priorityScore(),
        request.territoryId(),
        request.notes(),
        request.whatsappNumber(),
        request.email(),
        request.lat(),
        request.lon()
    );
    doctor.setUpdatedAt(OffsetDateTime.now());
    doctorRepository.save(doctor);

    auditLogService.log(actorUserId, "DOCTOR_UPDATED", "DOCTOR", doctor.getId(), Map.of(
        "fullName", doctor.getFullName(),
        "previousTerritoryId", previousTerritoryId == null ? "" : previousTerritoryId.toString(),
        "newTerritoryId", doctor.getTerritoryId() == null ? "" : doctor.getTerritoryId().toString(),
        "tier", doctor.getTier()
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
        doctor.getEmail(),
        doctor.getLocation() == null ? null : doctor.getLocation().getY(),
        doctor.getLocation() == null ? null : doctor.getLocation().getX()
    );
  }

  private String normalizeFilter(String input) {
    if (input == null) {
      return null;
    }
    String trimmed = input.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private Integer normalizePriority(Integer priorityScore) {
    if (priorityScore == null) {
      return null;
    }
    return Math.max(priorityScore, 0);
  }

  private void validateTerritoryExists(UUID territoryId) {
    if (territoryId != null && !territoryRepository.existsById(territoryId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Territory not found");
    }
  }

  private void validateCoordinates(Double lat, Double lon) {
    if ((lat == null) != (lon == null)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Both lat and lon are required when setting location");
    }
  }

  private void applyDoctorAttributes(
      Doctor doctor,
      String fullName,
      String specialty,
      String tier,
      int priorityScore,
      UUID territoryId,
      String notes,
      String whatsappNumber,
      String email,
      Double lat,
      Double lon
  ) {
    doctor.setFullName(fullName.trim());
    doctor.setSpecialty(trimToNull(specialty));
    doctor.setTier(tier.trim().toUpperCase());
    doctor.setPriorityScore(priorityScore);
    doctor.setTerritoryId(territoryId);
    doctor.setNotes(trimToNull(notes));
    doctor.setWhatsappNumber(trimToNull(whatsappNumber));
    doctor.setEmail(trimToNull(email));
    Point location = lat == null ? null : GEOMETRY_FACTORY.createPoint(new Coordinate(lon, lat));
    doctor.setLocation(location);
  }

  private String trimToNull(String input) {
    if (input == null) {
      return null;
    }
    String trimmed = input.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
