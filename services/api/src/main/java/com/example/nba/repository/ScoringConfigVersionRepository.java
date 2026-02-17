package com.example.nba.repository;

import com.example.nba.entity.ScoringConfigVersion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoringConfigVersionRepository extends JpaRepository<ScoringConfigVersion, UUID> {
  Optional<ScoringConfigVersion> findByActiveTrue();
  Optional<ScoringConfigVersion> findTopByOrderByVersionDesc();
  List<ScoringConfigVersion> findAllByOrderByVersionDesc();
}
