package com.example.nba.service;

import com.example.nba.dto.FeedbackStatus;
import com.example.nba.dto.RecommendationFeedbackRequest;
import com.example.nba.dto.RecommendationFeedbackResponse;
import com.example.nba.dto.SyncConflictStrategy;
import com.example.nba.dto.SyncFeedbackRequest;
import com.example.nba.entity.Recommendation;
import com.example.nba.entity.RecommendationFeedback;
import com.example.nba.repository.RecommendationFeedbackRepository;
import com.example.nba.repository.RecommendationRepository;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecommendationFeedbackService {
  private final RecommendationRepository recommendationRepository;
  private final RecommendationFeedbackRepository feedbackRepository;
  private final DoctorService doctorService;
  private final AuditLogService auditLogService;

  public RecommendationFeedbackService(RecommendationRepository recommendationRepository,
                                       RecommendationFeedbackRepository feedbackRepository,
                                       DoctorService doctorService,
                                       AuditLogService auditLogService) {
    this.recommendationRepository = recommendationRepository;
    this.feedbackRepository = feedbackRepository;
    this.doctorService = doctorService;
    this.auditLogService = auditLogService;
  }

  @Transactional
  public RecommendationFeedbackResponse submitFeedback(UUID recommendationId,
                                                       RecommendationFeedbackRequest request,
                                                       UUID userId,
                                                       boolean enforceMrScope) {
    SyncOutcome outcome = upsertFeedback(
        recommendationId,
        new SyncFeedbackRequest(
            normalizeRequiredClientRef(request.clientReferenceId()),
            recommendationId,
            request.status(),
            request.reason(),
            request.overrideDoctorId(),
            request.rescheduledTo(),
            request.overrideNotes()),
        userId,
        enforceMrScope,
        SyncConflictStrategy.SERVER_WINS,
        false);
    return outcome.response();
  }

  @Transactional
  public SyncOutcome syncFeedback(SyncFeedbackRequest request,
                                  UUID userId,
                                  boolean enforceMrScope,
                                  SyncConflictStrategy strategy) {
    return upsertFeedback(request.recommendationId(), request, userId, enforceMrScope, strategy, true);
  }

  private SyncOutcome upsertFeedback(UUID recommendationId,
                                     SyncFeedbackRequest request,
                                     UUID userId,
                                     boolean enforceMrScope,
                                     SyncConflictStrategy strategy,
                                     boolean allowConflict) {
    Recommendation recommendation = recommendationRepository.findByIdAndUserId(recommendationId, userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recommendation not found"));

    validateBusinessRules(request, userId, enforceMrScope);
    String normalizedClientRef = normalizeRequiredClientRef(request.clientReferenceId());
    RecommendationFeedback existing = feedbackRepository
        .findByCreatedByUserIdAndClientReferenceId(userId, normalizedClientRef)
        .orElse(null);

    if (existing != null) {
      if (strategy == SyncConflictStrategy.SERVER_WINS && !samePayload(existing, request)) {
        if (allowConflict) {
          return new SyncOutcome(toResponse(existing), true, "Existing feedback differs on server");
        }
        return toSyncOutcome(existing, false, "Already recorded");
      }

      existing.setRecommendationId(recommendation.getId());
      existing.setStatus(request.status().name());
      existing.setReason(normalizeNullable(request.reason()));
      existing.setOverrideDoctorId(request.overrideDoctorId());
      existing.setRescheduledTo(request.rescheduledTo());
      existing.setOverrideNotes(normalizeNullable(request.overrideNotes()));
      existing.setUpdatedAt(OffsetDateTime.now());
      feedbackRepository.save(existing);
      return toSyncOutcome(existing, false, "Updated");
    }

    OffsetDateTime now = OffsetDateTime.now();
    RecommendationFeedback created = new RecommendationFeedback();
    created.setId(UUID.randomUUID());
    created.setRecommendationId(recommendation.getId());
    created.setCreatedByUserId(userId);
    created.setStatus(request.status().name());
    created.setReason(normalizeNullable(request.reason()));
    created.setOverrideDoctorId(request.overrideDoctorId());
    created.setRescheduledTo(request.rescheduledTo());
    created.setOverrideNotes(normalizeNullable(request.overrideNotes()));
    created.setClientReferenceId(normalizedClientRef);
    created.setCreatedAt(now);
    created.setUpdatedAt(now);
    feedbackRepository.save(created);

    auditLogService.log(userId, "RECOMMENDATION_FEEDBACK_CAPTURED", "RECOMMENDATION_FEEDBACK", created.getId(), Map.of(
        "recommendationId", recommendation.getId().toString(),
        "status", created.getStatus(),
        "overrideDoctorId", created.getOverrideDoctorId() == null ? "" : created.getOverrideDoctorId().toString()
    ));

    return toSyncOutcome(created, false, "Created");
  }

  private void validateBusinessRules(SyncFeedbackRequest request, UUID userId, boolean enforceMrScope) {
    if (request.status() == FeedbackStatus.RESCHEDULED && request.rescheduledTo() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rescheduledTo is required for RESCHEDULED status");
    }
    if (request.overrideDoctorId() != null) {
      doctorService.validateDoctorAccess(request.overrideDoctorId(), userId, enforceMrScope);
    }
  }

  private boolean samePayload(RecommendationFeedback entity, SyncFeedbackRequest request) {
    if (!entity.getRecommendationId().equals(request.recommendationId())) {
      return false;
    }
    if (!entity.getStatus().equals(request.status().name())) {
      return false;
    }
    if (!equalsNullable(entity.getReason(), normalizeNullable(request.reason()))) {
      return false;
    }
    if (!equalsNullable(entity.getOverrideDoctorId(), request.overrideDoctorId())) {
      return false;
    }
    if (!equalsNullable(entity.getRescheduledTo(), request.rescheduledTo())) {
      return false;
    }
    return equalsNullable(entity.getOverrideNotes(), normalizeNullable(request.overrideNotes()));
  }

  private boolean equalsNullable(Object left, Object right) {
    if (left == null) {
      return right == null;
    }
    return left.equals(right);
  }

  private String normalizeRequiredClientRef(String value) {
    if (value == null || value.trim().isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "clientReferenceId is required");
    }
    return value.trim();
  }

  private String normalizeNullable(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private SyncOutcome toSyncOutcome(RecommendationFeedback feedback, boolean conflict, String message) {
    return new SyncOutcome(toResponse(feedback), conflict, message);
  }

  private RecommendationFeedbackResponse toResponse(RecommendationFeedback feedback) {
    return new RecommendationFeedbackResponse(
        feedback.getId(),
        feedback.getRecommendationId(),
        feedback.getStatus(),
        feedback.getReason(),
        feedback.getOverrideDoctorId(),
        feedback.getRescheduledTo(),
        feedback.getOverrideNotes(),
        feedback.getClientReferenceId(),
        feedback.getCreatedAt(),
        feedback.getUpdatedAt());
  }

  public record SyncOutcome(
      RecommendationFeedbackResponse response,
      boolean conflict,
      String message
  ) {}
}