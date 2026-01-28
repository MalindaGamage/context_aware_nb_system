package com.example.nba.service;

import com.example.nba.dto.TerritoryResponse;
import com.example.nba.dto.UserSummaryResponse;
import com.example.nba.entity.TerritoryAssignment;
import com.example.nba.entity.User;
import com.example.nba.repository.TerritoryAssignmentRepository;
import com.example.nba.repository.TerritoryRepository;
import com.example.nba.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class UserService {
  private final UserRepository userRepository;
  private final TerritoryAssignmentRepository territoryAssignmentRepository;
  private final TerritoryRepository territoryRepository;
  private final TerritoryService territoryService;

  public UserService(UserRepository userRepository,
                     TerritoryAssignmentRepository territoryAssignmentRepository,
                     TerritoryRepository territoryRepository,
                     TerritoryService territoryService) {
    this.userRepository = userRepository;
    this.territoryAssignmentRepository = territoryAssignmentRepository;
    this.territoryRepository = territoryRepository;
    this.territoryService = territoryService;
  }

  public List<UserSummaryResponse> listMrSummaries() {
    List<User> users = userRepository.findByRole("MR");
    Map<UUID, List<TerritoryAssignment>> assignmentsByUser = territoryAssignmentRepository.findAll()
        .stream()
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

    return territoryAssignmentRepository.findByUserId(userId)
        .stream()
        .map(a -> territories.get(a.getTerritoryId()))
        .filter(t -> t != null)
        .collect(Collectors.toList());
  }
}