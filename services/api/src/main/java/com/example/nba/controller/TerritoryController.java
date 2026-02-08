package com.example.nba.controller;

import com.example.nba.dto.CreateTerritoryRequest;
import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UpdateTerritoryRequest;
import jakarta.validation.Valid;
import com.example.nba.service.TerritoryService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TerritoryController {
  private final TerritoryService territoryService;

  public TerritoryController(TerritoryService territoryService) {
    this.territoryService = territoryService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/territories")
  public List<TerritoryResponse> listTerritories() {
    return territoryService.listTerritories();
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/territories")
  public TerritoryResponse createTerritory(@Valid @RequestBody CreateTerritoryRequest request) {
    return territoryService.createTerritory(request);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/territories/{territoryId}")
  public TerritoryResponse updateTerritory(@PathVariable UUID territoryId,
                                           @Valid @RequestBody UpdateTerritoryRequest request) {
    return territoryService.updateTerritory(territoryId, request);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @DeleteMapping("/api/v1/territories/{territoryId}")
  public void deleteTerritory(@PathVariable UUID territoryId) {
    territoryService.deleteTerritory(territoryId);
  }
}
