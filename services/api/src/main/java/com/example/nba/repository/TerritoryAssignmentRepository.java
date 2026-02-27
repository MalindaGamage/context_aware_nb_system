package com.example.nba.repository;

import com.example.nba.entity.TerritoryAssignment;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TerritoryAssignmentRepository extends JpaRepository<TerritoryAssignment, UUID> {
  List<TerritoryAssignment> findByUserId(UUID userId);
  List<TerritoryAssignment> findByTerritoryId(UUID territoryId);
  List<TerritoryAssignment> findByUserIdAndTerritoryId(UUID userId, UUID territoryId);

  @Query(value = """
      SELECT CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END
      FROM territory_assignments
      WHERE user_id = :userId
        AND territory_id = :territoryId
        AND starts_on <= :onDate
        AND (ends_on IS NULL OR ends_on >= :onDate)
      """, nativeQuery = true)
  boolean existsActiveAssignmentOnDate(@Param("userId") UUID userId,
                                       @Param("territoryId") UUID territoryId,
                                       @Param("onDate") LocalDate onDate);

  @Query(value = """
      SELECT territory_id
      FROM territory_assignments
      WHERE user_id = :userId
        AND starts_on <= CURRENT_DATE
        AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
      """, nativeQuery = true)
  List<UUID> findActiveTerritoryIdsByUserId(@Param("userId") UUID userId);
}
