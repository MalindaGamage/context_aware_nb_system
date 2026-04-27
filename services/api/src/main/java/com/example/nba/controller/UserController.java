package com.example.nba.controller;

import com.example.nba.dto.AssignTerritoryRequest;
import com.example.nba.dto.CreateUserRequest;
import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UpdateUserRequest;
import com.example.nba.dto.UpdateUserSchedulePreferenceRequest;
import com.example.nba.dto.UserProfileResponse;
import com.example.nba.dto.UserSchedulePreferenceResponse;
import com.example.nba.dto.UserSummaryResponse;
import jakarta.validation.Valid;
import com.example.nba.service.UserService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
public class UserController {
  private static final Set<String> MR_ONLY = Set.of("MR");
  private static final Set<String> FIELD_REP_ROLES = Set.of("MR", "SALES_REP");

  private final UserService userService;

  public UserController(UserService userService) {
    this.userService = userService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/mrs")
  public List<UserSummaryResponse> listMrSummaries() {
    return userService.listMrSummaries();
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/mrs/profiles")
  public List<UserProfileResponse> listMrProfiles() {
    return userService.listMrProfiles();
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/users/mrs")
  public UserProfileResponse createMr(@Valid @RequestBody CreateUserRequest request) {
    return userService.createMr(request);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/users/mrs/{userId}")
  public UserProfileResponse updateMr(@PathVariable UUID userId, @Valid @RequestBody UpdateUserRequest request) {
    return userService.updateUser(userId, request, MR_ONLY);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @DeleteMapping("/api/v1/users/mrs/{userId}")
  public void deleteMr(@PathVariable UUID userId) {
    userService.deleteUser(userId, MR_ONLY);
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @GetMapping("/api/v1/users/managers")
  public List<UserProfileResponse> listManagers() {
    return userService.listManagerProfiles();
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PostMapping("/api/v1/users/managers")
  public UserProfileResponse createManager(@Valid @RequestBody CreateUserRequest request) {
    return userService.createManager(request);
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PutMapping("/api/v1/users/managers/{userId}")
  public UserProfileResponse updateManager(@PathVariable UUID userId, @Valid @RequestBody UpdateUserRequest request) {
    return userService.updateUser(userId, request, Set.of("MANAGER"));
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @DeleteMapping("/api/v1/users/managers/{userId}")
  public void deleteManager(@PathVariable UUID userId) {
    userService.deleteUser(userId, Set.of("MANAGER"));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/sales-reps")
  public List<UserProfileResponse> listSalesReps() {
    return userService.listSalesRepProfiles();
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PostMapping("/api/v1/users/sales-reps")
  public UserProfileResponse createSalesRep(@Valid @RequestBody CreateUserRequest request) {
    return userService.createSalesRep(request);
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @PutMapping("/api/v1/users/sales-reps/{userId}")
  public UserProfileResponse updateSalesRep(@PathVariable UUID userId, @Valid @RequestBody UpdateUserRequest request) {
    return userService.updateUser(userId, request, Set.of("SALES_REP"));
  }

  @PreAuthorize("hasAuthority('ROLE_ADMIN')")
  @DeleteMapping("/api/v1/users/sales-reps/{userId}")
  public void deleteSalesRep(@PathVariable UUID userId) {
    userService.deleteUser(userId, Set.of("SALES_REP"));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_SALES_REP','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/me/territories")
  public List<TerritoryResponse> myTerritories(@AuthenticationPrincipal Jwt jwt) {
    UUID userId = UUID.fromString(jwt.getSubject());
    return userService.listTerritoriesForUser(userId);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/me/schedule")
  public UserSchedulePreferenceResponse mySchedule(@AuthenticationPrincipal Jwt jwt) {
    return userService.getSchedulePreference(UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/users/me/schedule")
  public UserSchedulePreferenceResponse updateMySchedule(@AuthenticationPrincipal Jwt jwt,
                                                         @Valid @RequestBody UpdateUserSchedulePreferenceRequest request) {
    return userService.updateSchedulePreference(UUID.fromString(jwt.getSubject()), request);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PostMapping("/api/v1/users/{userId}/territories")
  public List<TerritoryResponse> assignTerritory(@PathVariable UUID userId,
                                                 @Valid @RequestBody AssignTerritoryRequest request) {
    return userService.replaceAssignments(userId, request, FIELD_REP_ROLES);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @DeleteMapping("/api/v1/users/{userId}/territories/{territoryId}")
  public List<TerritoryResponse> removeAssignment(@PathVariable UUID userId, @PathVariable UUID territoryId) {
    return userService.removeAssignment(userId, territoryId, FIELD_REP_ROLES);
  }
}
