package com.example.nba.service;

import com.example.nba.dto.AssignTerritoryRequest;
import com.example.nba.dto.CreateUserRequest;
import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UpdateUserSchedulePreferenceRequest;
import com.example.nba.dto.UpdateUserRequest;
import com.example.nba.dto.UserSchedulePreferenceResponse;
import com.example.nba.dto.UserProfileResponse;
import com.example.nba.entity.Role;
import com.example.nba.dto.UserSummaryResponse;
import com.example.nba.entity.TerritoryAssignment;
import com.example.nba.entity.User;
import com.example.nba.entity.UserSchedulePreference;
import com.example.nba.entity.UserRole;
import com.example.nba.entity.UserRoleId;
import com.example.nba.repository.RoleRepository;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.repository.UserRoleRepository;
import com.example.nba.repository.UserRepository;
import com.example.nba.repository.UserSchedulePreferenceRepository;
import java.time.LocalTime;
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
  private static final String ROLE_SALES_REP = "SALES_REP";

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final UserRoleRepository userRoleRepository;
  private final TerritoryAssignmentRepository territoryAssignmentRepository;
  private final TerritoryRepository territoryRepository;
  private final UserSchedulePreferenceRepository userSchedulePreferenceRepository;
  private final TerritoryService territoryService;

  public UserService(UserRepository userRepository,
                     RoleRepository roleRepository,
                     UserRoleRepository userRoleRepository,
                     TerritoryAssignmentRepository territoryAssignmentRepository,
                     TerritoryRepository territoryRepository,
                     UserSchedulePreferenceRepository userSchedulePreferenceRepository,
                     TerritoryService territoryService) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.userRoleRepository = userRoleRepository;
    this.territoryAssignmentRepository = territoryAssignmentRepository;
    this.territoryRepository = territoryRepository;
    this.userSchedulePreferenceRepository = userSchedulePreferenceRepository;
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
    return createUser(UUID.randomUUID(), request.fullName(), request.email(), roleName);
  }

  @Transactional
  public UserProfileResponse createRegisteredUser(UUID userId, String fullName, String email, String roleName) {
    return createUser(userId, fullName, email, roleName);
  }

  private UserProfileResponse createUser(UUID userId, String fullName, String email, String roleName) {
    userRepository.findByEmail(email.trim().toLowerCase())
        .ifPresent(existing -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        });

    Role role = roleRepository.findByName(roleName)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role"));

    OffsetDateTime now = OffsetDateTime.now();
    User user = new User();
    user.setId(userId);
    user.setFullName(fullName.trim());
    user.setEmail(email.trim().toLowerCase());
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

    LocalDate effectiveStartDate = request.startsOn() != null ? request.startsOn() : LocalDate.now();
    boolean alreadyAssigned = territoryAssignmentRepository.existsActiveAssignmentOnDate(
        userId, request.territoryId(), effectiveStartDate);
    if (!alreadyAssigned) {
      TerritoryAssignment assignment = new TerritoryAssignment();
      assignment.setId(UUID.randomUUID());
      assignment.setUserId(userId);
      assignment.setTerritoryId(request.territoryId());
      assignment.setStartsOn(effectiveStartDate);
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
    LocalDate today = LocalDate.now();
    List<TerritoryAssignment> assignments = territoryAssignmentRepository.findByUserIdAndTerritoryId(userId, territoryId);
    List<TerritoryAssignment> toDelete = new ArrayList<>();
    List<TerritoryAssignment> toClose = new ArrayList<>();

    for (TerritoryAssignment assignment : assignments) {
      if (assignment.getStartsOn().isAfter(today)) {
        toDelete.add(assignment);
        continue;
      }
      if (assignment.getEndsOn() == null || assignment.getEndsOn().isAfter(today)) {
        assignment.setEndsOn(today);
        toClose.add(assignment);
      }
    }

    if (!toClose.isEmpty()) {
      territoryAssignmentRepository.saveAll(toClose);
    }
    if (!toDelete.isEmpty()) {
      territoryAssignmentRepository.deleteAll(toDelete);
    }
    return listTerritoriesForUser(userId);
  }

  public List<UserProfileResponse> listMrProfiles() {
    return listUsersByRole(ROLE_MR);
  }

  public List<UserProfileResponse> listManagerProfiles() {
    return listUsersByRole(ROLE_MANAGER);
  }

  public List<UserProfileResponse> listSalesRepProfiles() {
    return listUsersByRole(ROLE_SALES_REP);
  }

  public UserProfileResponse createMr(CreateUserRequest request) {
    return createUser(request, ROLE_MR);
  }

  public UserProfileResponse createManager(CreateUserRequest request) {
    return createUser(request, ROLE_MANAGER);
  }

  public UserProfileResponse createSalesRep(CreateUserRequest request) {
    return createUser(request, ROLE_SALES_REP);
  }

  public UserSchedulePreferenceResponse getSchedulePreference(UUID userId) {
    ensureUserExists(userId);
    return toScheduleResponse(userSchedulePreferenceRepository.findById(userId).orElseGet(() -> defaultSchedule(userId)));
  }

  @Transactional
  public UserSchedulePreferenceResponse updateSchedulePreference(UUID userId, UpdateUserSchedulePreferenceRequest request) {
    ensureUserExists(userId);

    LocalTime workdayStart = parseTime(request.workdayStart(), "workdayStart");
    LocalTime workdayEnd = parseTime(request.workdayEnd(), "workdayEnd");
    LocalTime breakStart = parseOptionalTime(request.breakStart(), "breakStart");
    LocalTime breakEnd = parseOptionalTime(request.breakEnd(), "breakEnd");

    if (!workdayEnd.isAfter(workdayStart)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Workday end must be after workday start");
    }
    if ((breakStart == null) != (breakEnd == null)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Break start and break end must both be provided");
    }
    if (breakStart != null) {
      if (!breakEnd.isAfter(breakStart)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Break end must be after break start");
      }
      if (breakStart.isBefore(workdayStart) || breakEnd.isAfter(workdayEnd)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Break must be inside the workday window");
      }
    }

    OffsetDateTime now = OffsetDateTime.now();
    UserSchedulePreference entity = userSchedulePreferenceRepository.findById(userId).orElseGet(() -> {
      UserSchedulePreference created = new UserSchedulePreference();
      created.setUserId(userId);
      created.setCreatedAt(now);
      return created;
    });

    entity.setWorkdayStart(workdayStart);
    entity.setWorkdayEnd(workdayEnd);
    entity.setBreakStart(breakStart);
    entity.setBreakEnd(breakEnd);
    entity.setMaxVisitsPerDay(request.maxVisitsPerDay() != null ? request.maxVisitsPerDay() : 8);
    entity.setBaseLocationText(trimToNull(request.baseLocationText()));
    entity.setPlanningNotes(trimToNull(request.planningNotes()));
    entity.setUpdatedAt(now);

    return toScheduleResponse(userSchedulePreferenceRepository.save(entity));
  }

  private UserProfileResponse toUserProfile(UUID id, String fullName, String email, boolean active, String role) {
    List<TerritoryResponse> territories = listTerritoriesForUser(id);
    return new UserProfileResponse(id, fullName, email, active, role, territories);
  }

  private void ensureUserExists(UUID userId) {
    if (!userRepository.existsById(userId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }
  }

  private UserSchedulePreference defaultSchedule(UUID userId) {
    UserSchedulePreference fallback = new UserSchedulePreference();
    fallback.setUserId(userId);
    fallback.setWorkdayStart(LocalTime.of(8, 30));
    fallback.setWorkdayEnd(LocalTime.of(17, 30));
    fallback.setMaxVisitsPerDay(8);
    fallback.setUpdatedAt(OffsetDateTime.now());
    fallback.setCreatedAt(fallback.getUpdatedAt());
    return fallback;
  }

  private UserSchedulePreferenceResponse toScheduleResponse(UserSchedulePreference entity) {
    return new UserSchedulePreferenceResponse(
        entity.getUserId(),
        formatTime(entity.getWorkdayStart()),
        formatTime(entity.getWorkdayEnd()),
        formatTime(entity.getBreakStart()),
        formatTime(entity.getBreakEnd()),
        entity.getMaxVisitsPerDay(),
        entity.getBaseLocationText(),
        entity.getPlanningNotes(),
        entity.getUpdatedAt()
    );
  }

  private LocalTime parseTime(String value, String fieldName) {
    try {
      return LocalTime.parse(value.trim());
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid time for " + fieldName);
    }
  }

  private LocalTime parseOptionalTime(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return parseTime(value, fieldName);
  }

  private String formatTime(LocalTime value) {
    return value != null ? value.toString() : null;
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
