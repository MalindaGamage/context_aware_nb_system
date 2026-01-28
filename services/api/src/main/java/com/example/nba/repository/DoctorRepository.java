package com.example.nba.repository;

import com.example.nba.entity.Doctor;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DoctorRepository extends JpaRepository<Doctor, UUID>, JpaSpecificationExecutor<Doctor> {
  Page<Doctor> findAll(org.springframework.data.jpa.domain.Specification<Doctor> spec, Pageable pageable);

  @Query(value = """
      SELECT * FROM doctors
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
  List<Doctor> findNearby(@Param("lat") double lat, @Param("lon") double lon, @Param("radiusMeters") double radiusMeters, @Param("limit") int limit);
}