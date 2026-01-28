package com.example.nba.service;

import com.example.nba.dto.TerritoryResponse;
import com.example.nba.entity.Territory;
import com.example.nba.repository.TerritoryRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

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

  public TerritoryResponse toResponse(Territory territory) {
    return new TerritoryResponse(territory.getId(), territory.getName(), territory.getCode());
  }
}