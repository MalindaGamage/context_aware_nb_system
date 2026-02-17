package com.example.nba.repository;

import com.example.nba.entity.Recommendation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID>, JpaSpecificationExecutor<Recommendation> {
  Optional<Recommendation> findByIdAndUserId(UUID id, UUID userId);
}
