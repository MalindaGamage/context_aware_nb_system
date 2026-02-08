package com.example.nba.service;

import com.example.nba.dto.AssignTerritoryRequest;
import com.example.nba.dto.CreateUserRequest;
import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UpdateUserRequest;
import com.example.nba.dto.UserProfileResponse;
import com.example.nba.entity.Role;
import com.example.nba.dto.UserSummaryResponse;
import com.example.nba.entity.TerritoryAssignment;
import com.example.nba.entity.User;
import com.example.nba.entity.UserRole;
import com.example.nba.entity.UserRoleId;
import com.example.nba.repository.RoleRepository;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.repository.UserRoleRepository;
import com.example.nba.repository.UserRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class UserService {
  private static final String ROLE_MR = "MR";
  private static final String ROLE_MANAGER = "MANAGER";

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final UserRoleRepository userRoleRepository;
  private final TerritoryAssignmentRepository territoryAssignmentRepository;
  private final TerritoryRepository territoryRepository;
  private final TerritoryService territoryService;

  public UserService(UserRepository userRepository,
                     RoleRepository roleRepository,
                     UserRoleRepository userRoleRepository,
                     TerritoryAssignmentRepository territoryAssignmentRepository,
                     TerritoryRepository territoryRepository,
                     TerritoryService territoryService) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.userRoleRepository = userRoleRepository;
    this.territoryAssignmentRepository = territoryAssignmentRepository;
    this.territoryRepository = territoryRepository;
    this.territoryService = territoryService;
  }

  public List<UserSummaryResponse> listMrSummaries() {
    List<User> users = userRepository.findByRole(ROLE_MR);
    LocalDate today = LocalDate.now();
    Map<UUID, List<TerritoryAssignment>> assignmentsByUser = territoryAssignmentRepository.findAll()
        .stream()
        .filter(assignment -> !assignment.getStartsOn().isAfter(today))
        .filter(assignment -> assignment.getEndsOn() == null || !assignment.getEndsOn().isBefore(today))
        .collect(Collectors.groupingBy(TerritoryAssignment::getUserId));

    Map<UUID, TerritoryResponse> territories = territoryRepository.findAll()
        .stream()
        .collect(Collectors.toMap(t -> t.getId(), territoryService::toResponse));

    List<UserSummaryResponse> result = new ArrayList<>();
    for (User user : users) {
      List<TerritoryResponse> assigned = assignmentsByUser
          .getOrDefault(user.getId(), List.of())
          .stream()
          .map(a -> territories.get(a.getTerritoryId()))
          .filter(t -> t != null)
          .collect(Collectors.toList());

      result.add(new UserSummaryResponse(user.getId(), user.getFullName(), user.getEmail(), assigned));
    }
    return result;
  }

  public List<TerritoryResponse> listTerritoriesForUser(UUID userId) {
    Map<UUID, TerritoryResponse> territories = territoryRepository.findAll()
        .stream()
        .collect(Collectors.toMap(t -> t.getId(), territoryService::toResponse));

    return territoryAssignmentRepository.findActiveTerritoryIdsByUserId(userId)
        .stream()
        .map(territories::get)
        .filter(t -> t != null)
        .collect(Collectors.toList());
  }

  public List<UserProfileResponse> listUsersByRole(String role) {
    return userRepository.findRoleViewByRole(role).stream()
        .map(view -> toUserProfile(view.getId(), view.getFullName(), view.getEmail(), view.getActive(), view.getRole()))
        .collect(Collectors.toList());
  }

  @Transactional
  public UserProfileResponse createUser(CreateUserRequest request, String roleName) {
    userRepository.findByEmail(request.email().trim())
        .ifPresent(existing -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        });

    Role role = roleRepository.findByName(roleName)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role"));

    OffsetDateTime now = OffsetDateTime.now();
    User user = new User();
    user.setId(UUID.randomUUID());
    user.setFullName(request.fullName().trim());
    user.setEmail(request.email().trim().toLowerCase());
    user.setActive(true);
    user.setCreatedAt(now);
    user.setUpdatedAt(now);
    userRepository.save(user);

    UserRole userRole = new UserRole();
    userRole.setId(new UserRoleId(user.getId(), role.getId()));
    userRoleRepository.save(userRole);

    return toUserProfile(user.getId(), user.getFullName(), user.getEmail(), user.isActive(), roleName);
  }

  @Transactional
  public UserProfileResponse updateUser(UUID userId, UpdateUserRequest request, Set<String> allowedRoles) {
    UserRepository.UserRoleView existing = userRepository.findRoleViewByUserId(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    if (!allowedRoles.contains(existing.getRole())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }

    userRepository.findByEmail(request.email().trim().toLowerCase())
        .filter(found -> !found.getId().equals(userId))
        .ifPresent(found -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        });

    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    user.setFullName(request.fullName().trim());
    user.setEmail(request.email().trim().toLowerCase());
    user.setActive(request.active());
    user.setUpdatedAt(OffsetDateTime.now());
    userRepository.save(user);

    return toUserProfile(user.getId(), user.getFullName(), user.getEmail(), user.isActive(), existing.getRole());
  }

  @Transactional
  public void deleteUser(UUID userId, Set<String> allowedRoles) {
    UserRepository.UserRoleView existing = userRepository.findRoleViewByUserId(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (!allowedRoles.contains(existing.getRole())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }
    userRepository.deleteById(userId);
  }

  @Transactional
  public List<TerritoryResponse> replaceAssignments(UUID userId, AssignTerritoryRequest request, Set<String> allowedRoles) {
    UserRepository.UserRoleView existing = userRepository.findRoleViewByUserId(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (!allowedRoles.contains(existing.getRole())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }

    territoryRepository.findById(request.territoryId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Territory not found"));

    boolean alreadyAssigned = territoryAssignmentRepository.existsByUserIdAndTerritoryIdAndEndsOnIsNull(
        userId, request.territoryId());
    if (!alreadyAssigned) {
      TerritoryAssignment assignment = new TerritoryAssignment();
      assignment.setId(UUID.randomUUID());
      assignment.setUserId(userId);
      assignment.setTerritoryId(request.territoryId());
      assignment.setStartsOn(request.startsOn() != null ? request.startsOn() : LocalDate.now());
      assignment.setCreatedAt(OffsetDateTime.now());
      territoryAssignmentRepository.save(assignment);
    }
    return listTerritoriesForUser(userId);
  }

  @Transactional
  public List<TerritoryResponse> removeAssignment(UUID userId, UUID territoryId, Set<String> allowedRoles) {
    UserRepository.UserRoleView existing = userRepository.findRoleViewByUserId(userId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (!allowedRoles.contains(existing.getRole())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }
    List<TerritoryAssignment> assignments = territoryAssignmentRepository.findByUserId(userId).stream()
        .filter(item -> item.getTerritoryId().equals(territoryId))
        .collect(Collectors.toList());
    territoryAssignmentRepository.deleteAll(assignments);
    return listTerritoriesForUser(userId);
  }

  public List<UserProfileResponse> listMrProfiles() {
    return listUsersByRole(ROLE_MR);
  }

  public List<UserProfileResponse> listManagerProfiles() {
    return listUsersByRole(ROLE_MANAGER);
  }

  public UserProfileResponse createMr(CreateUserRequest request) {
    return createUser(request, ROLE_MR);
  }

  public UserProfileResponse createManager(CreateUserRequest request) {
    return createUser(request, ROLE_MANAGER);
  }

  private UserProfileResponse toUserProfile(UUID id, String fullName, String email, boolean active, String role) {
    List<TerritoryResponse> territories = listTerritoriesForUser(id);
    return new UserProfileResponse(id, fullName, email, active, role, territories);
  }
}
