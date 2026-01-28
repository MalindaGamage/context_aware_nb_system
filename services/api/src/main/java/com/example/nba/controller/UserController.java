package com.example.nba.controller;

import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UserSummaryResponse;
import com.example.nba.service.UserService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {
  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/mrs")
  public List<UserSummaryResponse> listMrSummaries() {
    return userService.listMrSummaries();
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/me/territories")
  public List<TerritoryResponse> myTerritories(@AuthenticationPrincipal Jwt jwt) {
    UUID userId = UUID.fromString(jwt.getSubject());
    return userService.listTerritoriesForUser(userId);
  }
}