package com.example.nba.service;

import com.example.nba.dto.CreateScoringConfigRequest;
import com.example.nba.dto.ScoringConfigResponse;
import com.example.nba.entity.ScoringConfigVersion;
import com.example.nba.repository.ScoringConfigVersionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ScoringConfigService {
  private final ScoringConfigVersionRepository repository;
  private final ObjectMapper objectMapper;
  private final AuditLogService auditLogService;

  public ScoringConfigService(ScoringConfigVersionRepository repository,
                              ObjectMapper objectMapper,
                              AuditLogService auditLogService) {
    this.repository = repository;
    this.objectMapper = objectMapper;
    this.auditLogService = auditLogService;
  }

  public ScoringConfigResponse getActive() {
    ScoringConfigVersion config = repository.findByActiveTrue()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Active scoring config not found"));
    return toResponse(config);
  }

  public List<ScoringConfigResponse> listVersions() {
    return repository.findAllByOrderByVersionDesc().stream()
        .map(this::toResponse)
        .collect(Collectors.toList());
  }

  @Transactional
  public ScoringConfigResponse createVersion(CreateScoringConfigRequest request, UUID actorUserId) {
    int nextVersion = repository.findTopByOrderByVersionDesc()
        .map(item -> item.getVersion() + 1)
        .orElse(1);

    ScoringConfigVersion config = new ScoringConfigVersion();
    config.setId(UUID.randomUUID());
    config.setVersion(nextVersion);
    config.setName(request.name().trim());
    config.setWeights(toJson(request.weights()));
    config.setMessages(toJson(request.messages()));
    config.setSegments(toJson(request.segments()));
    config.setActive(request.activate());
    config.setCreatedByUserId(actorUserId);
    config.setCreatedAt(OffsetDateTime.now());

    if (request.activate()) {
      deactivateCurrent();
    }
    repository.save(config);

    auditLogService.log(actorUserId, "SCORING_CONFIG_CREATED", "SCORING_CONFIG", config.getId(), Map.of(
        "version", config.getVersion(),
        "name", config.getName(),
        "active", config.isActive()
    ));

    return toResponse(config);
  }

  @Transactional
  public ScoringConfigResponse activate(UUID configId, UUID actorUserId) {
    ScoringConfigVersion config = repository.findById(configId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Scoring config not found"));
    deactivateCurrent();
    config.setActive(true);
    repository.save(config);

    auditLogService.log(actorUserId, "SCORING_CONFIG_ACTIVATED", "SCORING_CONFIG", config.getId(), Map.of(
        "version", config.getVersion(),
        "name", config.getName()
    ));
    return toResponse(config);
  }

  private void deactivateCurrent() {
    repository.findByActiveTrue().ifPresent(current -> {
      current.setActive(false);
      repository.save(current);
    });
  }

  private ScoringConfigResponse toResponse(ScoringConfigVersion config) {
    return new ScoringConfigResponse(
        config.getId(),
        config.getVersion(),
        config.getName(),
        parseNode(config.getWeights()),
        parseNode(config.getMessages()),
        parseNode(config.getSegments()),
        config.isActive(),
        config.getCreatedByUserId(),
        config.getCreatedAt()
    );
  }

  private String toJson(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid JSON payload", ex);
    }
  }

  private JsonNode parseNode(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (Exception ex) {
      return objectMapper.createObjectNode();
    }
  }
}
