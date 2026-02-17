package com.example.nba.service;

import com.example.nba.dto.CaptureVisitGpsRequest;
import com.example.nba.dto.CreateVisitRequest;
import com.example.nba.dto.UpdateVisitRequest;
import com.example.nba.dto.VisitResponse;
import com.example.nba.entity.Visit;
import com.example.nba.repository.VisitRepository;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VisitService {
  private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);
  private static final int MAX_OUTCOME_LENGTH = 120;
  private static final int MAX_NOTES_LENGTH = 2000;

  private final VisitRepository visitRepository;
  private final DoctorService doctorService;
  private final AuditLogService auditLogService;

  public VisitService(VisitRepository visitRepository,
                      DoctorService doctorService,
                      AuditLogService auditLogService) {
    this.visitRepository = visitRepository;
    this.doctorService = doctorService;
    this.auditLogService = auditLogService;
  }

  @Transactional
  public VisitResponse createVisit(CreateVisitRequest request, UUID actorUserId, boolean enforceMrScope) {
    doctorService.validateDoctorAccess(request.doctorId(), actorUserId, enforceMrScope);
    String clientReferenceId = normalizeClientReference(request.clientReferenceId());
    if (clientReferenceId != null) {
      Visit existing = visitRepository.findByUserIdAndClientReferenceId(actorUserId, clientReferenceId).orElse(null);
      if (existing != null) {
        return toResponse(existing);
      }
    }

    OffsetDateTime now = OffsetDateTime.now();
    Visit visit = new Visit();
    visit.setId(UUID.randomUUID());
    visit.setDoctorId(request.doctorId());
    visit.setUserId(actorUserId);
    visit.setVisitTime(validateVisitTime(request.visitTime()));
    visit.setOutcome(normalizeOutcome(request.outcome()));
    visit.setNotes(normalizeNotes(request.notes()));
    visit.setFollowUpRequired(request.followUpRequired());
    visit.setClientReferenceId(clientReferenceId);
    visit.setCreatedAt(now);
    visit.setUpdatedAt(now);
    visitRepository.save(visit);

    auditLogService.log(actorUserId, "VISIT_CREATED", "VISIT", visit.getId(), Map.of(
        "doctorId", visit.getDoctorId().toString(),
        "followUpRequired", visit.isFollowUpRequired(),
        "outcome", visit.getOutcome()
    ));

    return toResponse(visit);
  }

  public Page<VisitResponse> listMyVisits(UUID actorUserId, Pageable pageable) {
    return visitRepository.findByUserIdOrderByVisitTimeDesc(actorUserId, pageable).map(this::toResponse);
  }

  public Page<VisitResponse> listDoctorVisits(UUID doctorId, UUID actorUserId, boolean enforceMrScope, Pageable pageable) {
    doctorService.validateDoctorAccess(doctorId, actorUserId, enforceMrScope);
    return visitRepository.findByDoctorIdOrderByVisitTimeDesc(doctorId, pageable).map(this::toResponse);
  }

  public VisitResponse getVisit(UUID visitId, UUID actorUserId, boolean mrOnlyOwnVisits) {
    Visit visit = resolveVisit(visitId, actorUserId, mrOnlyOwnVisits);
    return toResponse(visit);
  }

  @Transactional
  public VisitResponse updateVisit(UUID visitId, UpdateVisitRequest request, UUID actorUserId, boolean mrOnlyOwnVisits) {
    Visit visit = resolveVisit(visitId, actorUserId, mrOnlyOwnVisits);
    String oldOutcome = visit.getOutcome();
    boolean oldFollowUp = visit.isFollowUpRequired();
    String oldNotes = visit.getNotes();

    visit.setVisitTime(validateVisitTime(request.visitTime()));
    visit.setOutcome(normalizeOutcome(request.outcome()));
    visit.setNotes(normalizeNotes(request.notes()));
    visit.setFollowUpRequired(request.followUpRequired());
    visit.setUpdatedAt(OffsetDateTime.now());
    visitRepository.save(visit);

    auditLogService.log(actorUserId, "VISIT_UPDATED", "VISIT", visit.getId(), Map.of(
        "oldOutcome", oldOutcome,
        "newOutcome", visit.getOutcome(),
        "oldFollowUpRequired", oldFollowUp,
        "newFollowUpRequired", visit.isFollowUpRequired(),
        "oldNotes", oldNotes == null ? "" : oldNotes,
        "newNotes", visit.getNotes() == null ? "" : visit.getNotes()
    ));

    return toResponse(visit);
  }

  @Transactional
  public VisitResponse captureGps(UUID visitId,
                                  CaptureVisitGpsRequest request,
                                  UUID actorUserId,
                                  boolean mrOnlyOwnVisits) {
    if (!request.optIn()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GPS capture requires opt-in");
    }
    if (request.lat() < -90 || request.lat() > 90 || request.lon() < -180 || request.lon() > 180) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid latitude/longitude");
    }

    Visit visit = resolveVisit(visitId, actorUserId, mrOnlyOwnVisits);
    Point point = GEOMETRY_FACTORY.createPoint(new org.locationtech.jts.geom.Coordinate(request.lon(), request.lat()));
    visit.setLocation(point);
    visit.setUpdatedAt(OffsetDateTime.now());
    visitRepository.save(visit);

    auditLogService.log(actorUserId, "VISIT_GPS_CAPTURED", "VISIT", visit.getId(), Map.of(
        "gpsCaptured", true,
        "optIn", true
    ));
    return toResponse(visit);
  }

  private Visit resolveVisit(UUID visitId, UUID actorUserId, boolean mrOnlyOwnVisits) {
    if (mrOnlyOwnVisits) {
      return visitRepository.findByIdAndUserId(visitId, actorUserId)
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit not found"));
    }
    return visitRepository.findById(visitId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Visit not found"));
  }

  private String normalizeNotes(String notes) {
    if (notes == null) {
      return null;
    }
    String trimmed = notes.trim();
    if (trimmed.length() > MAX_NOTES_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes length must be <= " + MAX_NOTES_LENGTH);
    }
    return trimmed.isEmpty() ? null : trimmed;
  }

  private String normalizeOutcome(String outcome) {
    String trimmed = outcome.trim();
    if (trimmed.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outcome is required");
    }
    if (trimmed.length() > MAX_OUTCOME_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Outcome length must be <= " + MAX_OUTCOME_LENGTH);
    }
    return trimmed;
  }

  private OffsetDateTime validateVisitTime(OffsetDateTime visitTime) {
    OffsetDateTime now = OffsetDateTime.now();
    if (visitTime.isAfter(now.plusMinutes(5))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visit time cannot be in the future");
    }
    if (visitTime.isBefore(now.minusYears(2))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Visit time is too old");
    }
    return visitTime;
  }

  private String normalizeClientReference(String clientReferenceId) {
    if (clientReferenceId == null) {
      return null;
    }
    String trimmed = clientReferenceId.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private VisitResponse toResponse(Visit visit) {
    return new VisitResponse(
        visit.getId(),
        visit.getDoctorId(),
        visit.getUserId(),
        visit.getVisitTime(),
        visit.getOutcome(),
        visit.getNotes(),
        visit.isFollowUpRequired(),
        visit.getClientReferenceId(),
        visit.getLocation() != null,
        visit.getCreatedAt(),
        visit.getUpdatedAt()
    );
  }
}
