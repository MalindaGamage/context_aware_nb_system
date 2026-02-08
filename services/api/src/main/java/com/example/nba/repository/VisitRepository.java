package com.example.nba.repository;

import com.example.nba.entity.Visit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VisitRepository extends JpaRepository<Visit, UUID> {
  Page<Visit> findByDoctorIdOrderByVisitTimeDesc(UUID doctorId, Pageable pageable);
  Page<Visit> findByUserIdOrderByVisitTimeDesc(UUID userId, Pageable pageable);
  Optional<Visit> findByIdAndUserId(UUID id, UUID userId);
}
