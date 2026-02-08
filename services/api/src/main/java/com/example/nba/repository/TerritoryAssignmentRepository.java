package com.example.nba.repository;

import com.example.nba.entity.TerritoryAssignment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TerritoryAssignmentRepository extends JpaRepository<TerritoryAssignment, UUID> {
  List<TerritoryAssignment> findByUserId(UUID userId);
  List<TerritoryAssignment> findByTerritoryId(UUID territoryId);
  boolean existsByUserIdAndTerritoryIdAndEndsOnIsNull(UUID userId, UUID territoryId);

  @Query(value = """
      SELECT territory_id
      FROM territory_assignments
      WHERE user_id = :userId
        AND starts_on <= CURRENT_DATE
        AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
      """, nativeQuery = true)
  List<UUID> findActiveTerritoryIdsByUserId(@Param("userId") UUID userId);
}
