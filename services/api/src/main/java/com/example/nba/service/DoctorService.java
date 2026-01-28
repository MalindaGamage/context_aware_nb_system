package com.example.nba.service;

import com.example.nba.dto.DoctorResponse;
import com.example.nba.entity.Doctor;
import com.example.nba.repository.DoctorRepository;
import com.example.nba.spec.DoctorSpecifications;
import java.util.List;
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

  public DoctorService(DoctorRepository doctorRepository) {
    this.doctorRepository = doctorRepository;
  }

  public Page<DoctorResponse> listDoctors(String tier, String specialty, UUID territoryId, Pageable pageable) {
    Specification<Doctor> spec = Specification.where(DoctorSpecifications.hasTier(tier))
        .and(DoctorSpecifications.hasSpecialty(specialty))
        .and(DoctorSpecifications.hasTerritory(territoryId));

    return doctorRepository.findAll(spec, pageable)
        .map(this::toResponse);
  }

  public DoctorResponse getDoctor(UUID id) {
    return doctorRepository.findById(id)
        .map(this::toResponse)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Doctor not found"));
  }

  public List<DoctorResponse> findNearby(double lat, double lon, double radiusKm, int limit) {
    double radiusMeters = radiusKm * 1000.0;
    return doctorRepository.findNearby(lat, lon, radiusMeters, limit)
        .stream()
        .map(this::toResponse)
        .collect(Collectors.toList());
  }

  private DoctorResponse toResponse(Doctor doctor) {
    return new DoctorResponse(
        doctor.getId(),
        doctor.getFullName(),
        doctor.getSpecialty(),
        doctor.getTier(),
        doctor.getPriorityScore(),
        doctor.getTerritoryId(),
        doctor.getNotes()
    );
  }
}