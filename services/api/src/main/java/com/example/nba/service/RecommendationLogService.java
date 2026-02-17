package com.example.nba.service;

import com.example.nba.dto.PageMeta;
import com.example.nba.dto.PageResponse;
import com.example.nba.dto.RecommendationFactorResponse;
import com.example.nba.dto.RecommendationLogResponse;
import com.example.nba.entity.Doctor;
import com.example.nba.entity.Recommendation;
import com.example.nba.entity.RecommendationFeedback;
import com.example.nba.entity.RecommendationFactor;
import com.example.nba.repository.DoctorRepository;
import com.example.nba.repository.RecommendationFactorRepository;
import com.example.nba.repository.RecommendationFeedbackRepository;
import com.example.nba.repository.RecommendationRepository;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

@Service
public class RecommendationLogService {
  private final RecommendationRepository recommendationRepository;
  private final RecommendationFactorRepository recommendationFactorRepository;
  private final RecommendationFeedbackRepository recommendationFeedbackRepository;
  private final DoctorRepository doctorRepository;

  public RecommendationLogService(RecommendationRepository recommendationRepository,
                                  RecommendationFactorRepository recommendationFactorRepository,
                                  RecommendationFeedbackRepository recommendationFeedbackRepository,
                                  DoctorRepository doctorRepository) {
    this.recommendationRepository = recommendationRepository;
    this.recommendationFactorRepository = recommendationFactorRepository;
    this.recommendationFeedbackRepository = recommendationFeedbackRepository;
    this.doctorRepository = doctorRepository;
  }

  public PageResponse<RecommendationLogResponse> list(UUID userId, UUID doctorId, int page, int size) {
    Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)));
    Specification<Recommendation> spec = Specification.<Recommendation>where((root, query, cb) ->
            userId == null ? null : cb.equal(root.get("userId"), userId))
        .and((root, query, cb) -> doctorId == null ? null : cb.equal(root.get("doctorId"), doctorId));

    Page<RecommendationLogResponse> logs = recommendationRepository.findAll(spec, pageable)
        .map(this::toResponse);

    return new PageResponse<>(
        logs.getContent(),
        new PageMeta(logs.getNumber(), logs.getSize(), logs.getTotalElements(), logs.getTotalPages())
    );
  }

  private RecommendationLogResponse toResponse(Recommendation recommendation) {
    Doctor doctor = doctorRepository.findById(recommendation.getDoctorId()).orElse(null);
    List<RecommendationFactorResponse> drivers = recommendationFactorRepository
        .findByRecommendationIdOrderByContributionDesc(recommendation.getId())
        .stream()
        .map(this::toDriver)
        .collect(Collectors.toList());
    RecommendationFeedback latest = recommendationFeedbackRepository
        .findTopByRecommendationIdOrderByCreatedAtDesc(recommendation.getId())
        .orElse(null);

    return new RecommendationLogResponse(
        recommendation.getId(),
        recommendation.getUserId(),
        recommendation.getDoctorId(),
        doctor == null ? "Unknown Doctor" : doctor.getFullName(),
        recommendation.getScore().doubleValue(),
        recommendation.getExplanation(),
        recommendation.getCreatedAt(),
        drivers,
        latest == null ? null : latest.getStatus(),
        latest == null ? null : latest.getReason(),
        latest == null ? null : latest.getOverrideDoctorId()
    );
  }

  private RecommendationFactorResponse toDriver(RecommendationFactor factor) {
    return new RecommendationFactorResponse(
        factor.getFactorKey(),
        factor.getFactorValue(),
        factor.getContribution().doubleValue()
    );
  }
}
