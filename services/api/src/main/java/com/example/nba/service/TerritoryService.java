package com.example.nba.service;

import com.example.nba.dto.CreateTerritoryRequest;
import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UpdateTerritoryRequest;
import com.example.nba.entity.Territory;
import com.example.nba.repository.TerritoryRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class TerritoryService {
  private final TerritoryRepository territoryRepository;

  public TerritoryService(TerritoryRepository territoryRepository) {
    this.territoryRepository = territoryRepository;
  }

  public List<TerritoryResponse> listTerritories() {
    return territoryRepository.findAll()
        .stream()
        .map(this::toResponse)
        .collect(Collectors.toList());
  }

  @Transactional
  public TerritoryResponse createTerritory(CreateTerritoryRequest request) {
    territoryRepository.findByCode(request.code().trim())
        .ifPresent(existing -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Territory code already exists");
        });

    OffsetDateTime now = OffsetDateTime.now();
    Territory territory = new Territory();
    territory.setId(UUID.randomUUID());
    territory.setName(request.name().trim());
    territory.setCode(request.code().trim().toUpperCase());
    territory.setCreatedAt(now);
    territory.setUpdatedAt(now);
    territoryRepository.save(territory);
    return toResponse(territory);
  }

  @Transactional
  public TerritoryResponse updateTerritory(UUID territoryId, UpdateTerritoryRequest request) {
    Territory territory = territoryRepository.findById(territoryId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Territory not found"));

    territoryRepository.findByCode(request.code().trim().toUpperCase())
        .filter(existing -> !existing.getId().equals(territoryId))
        .ifPresent(existing -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Territory code already exists");
        });

    territory.setName(request.name().trim());
    territory.setCode(request.code().trim().toUpperCase());
    territory.setUpdatedAt(OffsetDateTime.now());
    territoryRepository.save(territory);
    return toResponse(territory);
  }

  @Transactional
  public void deleteTerritory(UUID territoryId) {
    if (!territoryRepository.existsById(territoryId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Territory not found");
    }
    territoryRepository.deleteById(territoryId);
  }

  public TerritoryResponse toResponse(Territory territory) {
    return new TerritoryResponse(territory.getId(), territory.getName(), territory.getCode());
  }
}
