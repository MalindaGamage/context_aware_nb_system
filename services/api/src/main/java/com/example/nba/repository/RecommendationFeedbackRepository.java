package com.example.nba.repository;

import com.example.nba.entity.RecommendationFeedback;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationFeedbackRepository extends JpaRepository<RecommendationFeedback, UUID> {
  Optional<RecommendationFeedback> findByCreatedByUserIdAndClientReferenceId(UUID userId, String clientReferenceId);
}