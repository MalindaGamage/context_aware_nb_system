package com.example.nba.repository;

import com.example.nba.entity.RecommendationFactor;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationFactorRepository extends JpaRepository<RecommendationFactor, UUID> {
}