package com.example.nba.controller;

import com.example.nba.dto.TerritoryResponse;
import com.example.nba.service.TerritoryService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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
}