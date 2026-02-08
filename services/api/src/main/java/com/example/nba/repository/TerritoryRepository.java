package com.example.nba.repository;

import com.example.nba.entity.Territory;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TerritoryRepository extends JpaRepository<Territory, UUID> {
  Optional<Territory> findByCode(String code);
}
