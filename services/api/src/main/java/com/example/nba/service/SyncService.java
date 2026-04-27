package com.example.nba.service;

import com.example.nba.dto.CreateVisitRequest;
import com.example.nba.dto.SyncBatchRequest;
import com.example.nba.dto.SyncBatchResponse;
import com.example.nba.dto.SyncConflict;
import com.example.nba.dto.SyncConflictStrategy;
import com.example.nba.dto.SyncFeedbackRequest;
import com.example.nba.dto.SyncItemResult;
import com.example.nba.dto.SyncVisitRequest;
import com.example.nba.dto.UpdateVisitRequest;
import com.example.nba.entity.Visit;
import com.example.nba.repository.VisitRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class SyncService {
  private final VisitRepository visitRepository;
  private final VisitService visitService;
  private final RecommendationFeedbackService recommendationFeedbackService;
  private final DoctorService doctorService;

  public SyncService(VisitRepository visitRepository,
                     VisitService visitService,
                     RecommendationFeedbackService recommendationFeedbackService,
                     DoctorService doctorService) {
    this.visitRepository = visitRepository;
    this.visitService = visitService;
    this.recommendationFeedbackService = recommendationFeedbackService;
    this.doctorService = doctorService;
  }

  @Transactional(noRollbackFor = ResponseStatusException.class)
  public SyncBatchResponse syncBatch(UUID userId, boolean enforceMrScope, SyncBatchRequest request) {
    SyncConflictStrategy strategy = request.strategy();
    List<SyncItemResult> visitResults = new ArrayList<>();
    List<SyncItemResult> feedbackResults = new ArrayList<>();
    List<SyncConflict> conflicts = new ArrayList<>();

    for (SyncVisitRequest visitRequest : nullSafe(request.visits())) {
      SyncItemResult result = syncVisit(userId, enforceMrScope, visitRequest, strategy, conflicts);
      visitResults.add(result);
    }

    for (SyncFeedbackRequest feedbackRequest : nullSafe(request.feedback())) {
      SyncItemResult rejected = null;
      RecommendationFeedbackService.SyncOutcome outcome = null;
      try {
        outcome = recommendationFeedbackService.syncFeedback(
            feedbackRequest,
            userId,
            enforceMrScope,
            strategy);
      } catch (ResponseStatusException ex) {
        String clientRef = feedbackRequest.clientReferenceId() == null ? "" : feedbackRequest.clientReferenceId();
        String message = ex.getReason() == null ? "Feedback could not be synced" : ex.getReason();
        conflicts.add(new SyncConflict(
            "feedback",
            clientRef,
            feedbackRequest.recommendationId() == null ? "" : feedbackRequest.recommendationId().toString(),
            message));
        rejected = new SyncItemResult(
            clientRef,
            "REJECTED",
            feedbackRequest.recommendationId() == null ? "" : feedbackRequest.recommendationId().toString(),
            message);
      }

      if (rejected != null) {
        feedbackResults.add(rejected);
        continue;
      }

      if (outcome.conflict()) {
        conflicts.add(new SyncConflict(
            "feedback",
            feedbackRequest.clientReferenceId(),
            outcome.response().id().toString(),
            outcome.message()));
        feedbackResults.add(new SyncItemResult(
            feedbackRequest.clientReferenceId(),
            "CONFLICT",
            outcome.response().id().toString(),
            outcome.message()));
      } else {
        feedbackResults.add(new SyncItemResult(
            feedbackRequest.clientReferenceId(),
            "APPLIED",
            outcome.response().id().toString(),
            outcome.message()));
      }
    }

    return new SyncBatchResponse(visitResults, feedbackResults, conflicts);
  }

  private SyncItemResult syncVisit(UUID userId,
                                   boolean enforceMrScope,
                                   SyncVisitRequest request,
                                   SyncConflictStrategy strategy,
                                   List<SyncConflict> conflicts) {
    String clientRef = request.clientReferenceId() == null ? "" : request.clientReferenceId().trim();
    if (clientRef.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "clientReferenceId is required");
    }
    doctorService.validateDoctorAccess(request.doctorId(), userId, enforceMrScope);

    Visit existing = visitRepository.findByUserIdAndClientReferenceId(userId, clientRef).orElse(null);
    if (existing == null) {
      var created = visitService.createVisit(new CreateVisitRequest(
          request.doctorId(),
          request.visitTime(),
          request.outcome(),
          request.notes(),
          request.followUpRequired(),
          clientRef), userId, enforceMrScope);
      return new SyncItemResult(clientRef, "APPLIED", created.id().toString(), "Created");
    }

    if (!existing.getDoctorId().equals(request.doctorId())) {
      conflicts.add(new SyncConflict("visit", clientRef, existing.getId().toString(), "Doctor cannot change for existing visit"));
      return new SyncItemResult(clientRef, "CONFLICT", existing.getId().toString(), "Doctor cannot change for existing visit");
    }

    if (sameVisit(existing, request)) {
      return new SyncItemResult(clientRef, "APPLIED", existing.getId().toString(), "No changes");
    }

    if (strategy == SyncConflictStrategy.SERVER_WINS && !sameVisit(existing, request)) {
      conflicts.add(new SyncConflict("visit", clientRef, existing.getId().toString(), "Existing visit differs on server"));
      return new SyncItemResult(clientRef, "CONFLICT", existing.getId().toString(), "Existing visit differs on server");
    }

    visitService.updateVisit(
        existing.getId(),
        new UpdateVisitRequest(
            request.visitTime(),
            request.outcome(),
            request.notes(),
            request.followUpRequired()),
        userId,
        enforceMrScope);

    return new SyncItemResult(clientRef, "APPLIED", existing.getId().toString(), "Updated");
  }

  private boolean sameVisit(Visit existing, SyncVisitRequest request) {
    if (!existing.getDoctorId().equals(request.doctorId())) {
      return false;
    }
    if (!existing.getVisitTime().equals(request.visitTime())) {
      return false;
    }
    if (!existing.getOutcome().equals(request.outcome().trim())) {
      return false;
    }
    if (!equalsNullable(existing.getNotes(), normalizeNullable(request.notes()))) {
      return false;
    }
    return existing.isFollowUpRequired() == request.followUpRequired();
  }

  private String normalizeNullable(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private boolean equalsNullable(Object left, Object right) {
    if (left == null) {
      return right == null;
    }
    return left.equals(right);
  }

  private <T> List<T> nullSafe(List<T> values) {
    return values == null ? List.of() : values;
  }
}
