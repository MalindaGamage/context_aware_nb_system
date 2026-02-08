package com.example.nba.repository;

import com.example.nba.entity.Recommendation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {
  Optional<Recommendation> findByIdAndUserId(UUID id, UUID userId);
}
