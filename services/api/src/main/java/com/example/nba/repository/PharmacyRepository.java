package com.example.nba.repository;

import com.example.nba.entity.Pharmacy;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PharmacyRepository extends JpaRepository<Pharmacy, UUID>, JpaSpecificationExecutor<Pharmacy> {
  Optional<Pharmacy> findByCode(String code);
  Optional<Pharmacy> findByGooglePlaceId(String googlePlaceId);

  Page<Pharmacy> findAll(org.springframework.data.jpa.domain.Specification<Pharmacy> spec, Pageable pageable);

  @Query(value = """
      SELECT * FROM pharmacies
      WHERE location IS NOT NULL
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
          :radiusMeters
        )
      ORDER BY ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
      )
      LIMIT :limit
      """, nativeQuery = true)
  List<Pharmacy> findNearby(@Param("lat") double lat, @Param("lon") double lon, @Param("radiusMeters") double radiusMeters, @Param("limit") int limit);

  @Query(value = """
      SELECT * FROM pharmacies
      WHERE location IS NOT NULL
        AND territory_id IN (:territoryIds)
        AND ST_DWithin(
          location::geography,
          ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
          :radiusMeters
        )
      ORDER BY ST_Distance(
          location::geography,
          ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
      )
      LIMIT :limit
      """, nativeQuery = true)
  List<Pharmacy> findNearbyInTerritories(
      @Param("territoryIds") List<UUID> territoryIds,
      @Param("lat") double lat,
      @Param("lon") double lon,
      @Param("radiusMeters") double radiusMeters,
      @Param("limit") int limit);
}
