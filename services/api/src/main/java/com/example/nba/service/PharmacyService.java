package com.example.nba.service;

import com.example.nba.dto.CreatePharmacyRequest;
import com.example.nba.dto.ImportGooglePharmacyRequest;
import com.example.nba.dto.PharmacyResponse;
import com.example.nba.dto.UpdatePharmacyRequest;
import com.example.nba.entity.Pharmacy;
import com.example.nba.repository.PharmacyRepository;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.spec.PharmacySpecifications;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;
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
public class PharmacyService {
  private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

  private final PharmacyRepository pharmacyRepository;
  private final TerritoryAssignmentRepository territoryAssignmentRepository;
  private final TerritoryRepository territoryRepository;
  private final AuditLogService auditLogService;

  public PharmacyService(PharmacyRepository pharmacyRepository,
                         TerritoryAssignmentRepository territoryAssignmentRepository,
                         TerritoryRepository territoryRepository,
                         AuditLogService auditLogService) {
    this.pharmacyRepository = pharmacyRepository;
    this.territoryAssignmentRepository = territoryAssignmentRepository;
    this.territoryRepository = territoryRepository;
    this.auditLogService = auditLogService;
  }

  public Page<PharmacyResponse> listPharmacies(UUID territoryId, UUID userId, boolean enforceAssignedTerritories, Pageable pageable) {
    List<UUID> allowedTerritories = resolveAllowedTerritories(userId, enforceAssignedTerritories);
    if (enforceAssignedTerritories && allowedTerritories.isEmpty()) {
      return Page.empty(pageable);
    }
    if (enforceAssignedTerritories && territoryId != null && !allowedTerritories.contains(territoryId)) {
      return Page.empty(pageable);
    }
    Specification<Pharmacy> spec = Specification.where(PharmacySpecifications.hasTerritory(territoryId))
        .and(enforceAssignedTerritories && territoryId == null ? PharmacySpecifications.inTerritories(allowedTerritories) : null);
    return pharmacyRepository.findAll(spec, pageable).map(this::toResponse);
  }

  public List<PharmacyResponse> findNearby(double lat, double lon, double radiusKm, int limit, UUID userId, boolean enforceAssignedTerritories) {
    double radiusMeters = radiusKm * 1000.0;
    List<Pharmacy> rows;
    if (enforceAssignedTerritories) {
      List<UUID> territories = resolveAllowedTerritories(userId, true);
      if (territories.isEmpty()) {
        return List.of();
      }
      rows = pharmacyRepository.findNearbyInTerritories(territories, lat, lon, radiusMeters, limit);
    } else {
      rows = pharmacyRepository.findNearby(lat, lon, radiusMeters, limit);
    }
    return rows.stream().map(this::toResponse).collect(Collectors.toList());
  }

  public PharmacyResponse create(CreatePharmacyRequest request, UUID actorUserId) {
    validateCoordinates(request.lat(), request.lon());
    validateTerritoryExists(request.territoryId());
    pharmacyRepository.findByCode(request.code().trim().toUpperCase()).ifPresent(existing -> {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Pharmacy code already exists");
    });

    OffsetDateTime now = OffsetDateTime.now();
    Pharmacy pharmacy = new Pharmacy();
    pharmacy.setId(UUID.randomUUID());
    applyAttributes(pharmacy, request.name(), request.code(), request.territoryId(), request.contactNumber(), request.notes(), request.lat(), request.lon());
    pharmacy.setCreatedAt(now);
    pharmacy.setUpdatedAt(now);
    pharmacyRepository.save(pharmacy);

    auditLogService.log(actorUserId, "PHARMACY_CREATED", "PHARMACY", pharmacy.getId(), Map.of("code", pharmacy.getCode()));
    return toResponse(pharmacy);
  }

  public PharmacyResponse importFromGooglePlace(ImportGooglePharmacyRequest request, UUID actorUserId) {
    validateCoordinates(request.lat(), request.lon());
    validateTerritoryExists(request.territoryId());

    OffsetDateTime now = OffsetDateTime.now();
    Pharmacy pharmacy = pharmacyRepository.findByGooglePlaceId(request.googlePlaceId().trim())
        .orElseGet(() -> {
          Pharmacy created = new Pharmacy();
          created.setId(UUID.randomUUID());
          created.setCreatedAt(now);
          created.setCode(generateGoogleCode(request.googlePlaceId()));
          return created;
        });

    pharmacy.setName(request.name().trim());
    pharmacy.setGooglePlaceId(request.googlePlaceId().trim());
    pharmacy.setAddress(trimToNull(request.address()));
    pharmacy.setTerritoryId(request.territoryId());
    pharmacy.setContactNumber(trimToNull(request.contactNumber()));
    pharmacy.setNotes(trimToNull(request.notes()));
    pharmacy.setLocation(GEOMETRY_FACTORY.createPoint(new Coordinate(request.lon(), request.lat())));
    pharmacy.setUpdatedAt(now);
    pharmacyRepository.save(pharmacy);

    auditLogService.log(
        actorUserId,
        "PHARMACY_IMPORTED_FROM_GOOGLE",
        "PHARMACY",
        pharmacy.getId(),
        Map.of(
            "googlePlaceId", pharmacy.getGooglePlaceId(),
            "territoryId", pharmacy.getTerritoryId().toString()
        )
    );
    return toResponse(pharmacy);
  }

  public PharmacyResponse update(UUID pharmacyId, UpdatePharmacyRequest request, UUID actorUserId) {
    validateCoordinates(request.lat(), request.lon());
    validateTerritoryExists(request.territoryId());
    Pharmacy pharmacy = pharmacyRepository.findById(pharmacyId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pharmacy not found"));
    pharmacyRepository.findByCode(request.code().trim().toUpperCase())
        .filter(existing -> !existing.getId().equals(pharmacyId))
        .ifPresent(existing -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Pharmacy code already exists"); });
    applyAttributes(pharmacy, request.name(), request.code(), request.territoryId(), request.contactNumber(), request.notes(), request.lat(), request.lon());
    pharmacy.setUpdatedAt(OffsetDateTime.now());
    pharmacyRepository.save(pharmacy);
    auditLogService.log(actorUserId, "PHARMACY_UPDATED", "PHARMACY", pharmacy.getId(), Map.of("code", pharmacy.getCode()));
    return toResponse(pharmacy);
  }

  public PharmacyResponse validateAccess(UUID pharmacyId, UUID userId, boolean enforceAssignedTerritories) {
    Pharmacy pharmacy = pharmacyRepository.findById(pharmacyId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pharmacy not found"));
    if (enforceAssignedTerritories) {
      List<UUID> territories = resolveAllowedTerritories(userId, true);
      if (pharmacy.getTerritoryId() == null || !territories.contains(pharmacy.getTerritoryId())) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pharmacy not found");
      }
    }
    return toResponse(pharmacy);
  }

  private void applyAttributes(Pharmacy pharmacy, String name, String code, UUID territoryId, String contactNumber, String notes, Double lat, Double lon) {
    pharmacy.setName(name.trim());
    pharmacy.setCode(code.trim().toUpperCase());
    pharmacy.setTerritoryId(territoryId);
    pharmacy.setContactNumber(trimToNull(contactNumber));
    pharmacy.setNotes(trimToNull(notes));
    Point location = lat == null ? null : GEOMETRY_FACTORY.createPoint(new Coordinate(lon, lat));
    pharmacy.setLocation(location);
  }

  private List<UUID> resolveAllowedTerritories(UUID userId, boolean enforceAssignedTerritories) {
    if (!enforceAssignedTerritories) return List.of();
    return territoryAssignmentRepository.findActiveTerritoryIdsByUserId(userId);
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

  private String trimToNull(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private PharmacyResponse toResponse(Pharmacy pharmacy) {
    return new PharmacyResponse(
        pharmacy.getId(),
        pharmacy.getName(),
        pharmacy.getCode(),
        pharmacy.getGooglePlaceId(),
        pharmacy.getAddress(),
        pharmacy.getTerritoryId(),
        pharmacy.getContactNumber(),
        pharmacy.getNotes(),
        pharmacy.getLocation() == null ? null : pharmacy.getLocation().getY(),
        pharmacy.getLocation() == null ? null : pharmacy.getLocation().getX()
    );
  }

  private String generateGoogleCode(String googlePlaceId) {
    String normalized = googlePlaceId.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    String base = "GM-" + (normalized.isEmpty() ? UUID.randomUUID().toString().replace("-", "").substring(0, 10) : normalized.substring(0, Math.min(18, normalized.length())));
    String candidate = base;
    int suffix = 1;
    while (pharmacyRepository.findByCode(candidate).isPresent()) {
      candidate = base + "-" + suffix;
      suffix++;
    }
    return candidate;
  }
}
