package com.example.nba.repository;

import com.example.nba.entity.TerritoryAssignment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TerritoryAssignmentRepository extends JpaRepository<TerritoryAssignment, UUID> {
  List<TerritoryAssignment> findByUserId(UUID userId);
}