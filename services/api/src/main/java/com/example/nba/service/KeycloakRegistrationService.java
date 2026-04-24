package com.example.nba.service;

import com.example.nba.dto.RegisterUserRequest;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KeycloakRegistrationService {
  private final RestClient restClient;
  private final String baseUrl;
  private final String realm;
  private final String adminUsername;
  private final String adminPassword;

  public KeycloakRegistrationService(
      RestClient.Builder restClientBuilder,
      @Value("${keycloak.admin.base-url:http://localhost:8081}") String baseUrl,
      @Value("${keycloak.realm:nba}") String realm,
      @Value("${keycloak.admin.username:admin}") String adminUsername,
      @Value("${keycloak.admin.password:admin}") String adminPassword) {
    this.restClient = restClientBuilder.build();
    this.baseUrl = trimTrailingSlash(baseUrl);
    this.realm = realm;
    this.adminUsername = adminUsername;
    this.adminPassword = adminPassword;
  }

  public UUID createUser(RegisterUserRequest request) {
    String token = adminToken();
    String roleId = realmRoleId(token, request.role());
    UUID userId = null;

    try {
      ResponseEntity<Void> response = restClient.post()
          .uri("%s/admin/realms/%s/users".formatted(baseUrl, realm))
          .contentType(MediaType.APPLICATION_JSON)
          .header("Authorization", "Bearer " + token)
          .body(Map.of(
              "username", request.username().trim(),
              "email", request.email().trim().toLowerCase(),
              "firstName", request.fullName().trim(),
              "enabled", true,
              "emailVerified", true,
              "credentials", List.of(Map.of(
                  "type", "password",
                  "value", request.password(),
                  "temporary", false))))
          .retrieve()
          .toBodilessEntity();

      userId = createdUserId(response);

      restClient.post()
          .uri("%s/admin/realms/%s/users/%s/role-mappings/realm".formatted(baseUrl, realm, userId))
          .contentType(MediaType.APPLICATION_JSON)
          .header("Authorization", "Bearer " + token)
          .body(List.of(Map.of("id", roleId, "name", request.role())))
          .retrieve()
          .toBodilessEntity();

      return userId;
    } catch (HttpClientErrorException.Conflict ex) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Username or email already exists");
    } catch (HttpClientErrorException ex) {
      if (userId != null) {
        deleteUser(userId);
      }
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to register identity user");
    }
  }

  public void deleteUser(UUID userId) {
    try {
      restClient.delete()
          .uri("%s/admin/realms/%s/users/%s".formatted(baseUrl, realm, userId))
          .header("Authorization", "Bearer " + adminToken())
          .retrieve()
          .toBodilessEntity();
    } catch (Exception ignored) {
      // Registration rollback should not hide the original local persistence failure.
    }
  }

  private String adminToken() {
    LinkedMultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("client_id", "admin-cli");
    body.add("grant_type", "password");
    body.add("username", adminUsername);
    body.add("password", adminPassword);

    Map<String, Object> response = restClient.post()
        .uri("%s/realms/master/protocol/openid-connect/token".formatted(baseUrl))
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(body)
        .retrieve()
        .body(new ParameterizedTypeReference<>() {});

    Object accessToken = response == null ? null : response.get("access_token");
    if (!(accessToken instanceof String token) || token.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to authenticate with identity provider");
    }
    return token;
  }

  private String realmRoleId(String token, String roleName) {
    Map<String, Object> response = restClient.get()
        .uri("%s/admin/realms/%s/roles/%s".formatted(baseUrl, realm, roleName))
        .header("Authorization", "Bearer " + token)
        .retrieve()
        .body(new ParameterizedTypeReference<>() {});

    Object id = response == null ? null : response.get("id");
    if (!(id instanceof String roleId) || roleId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to resolve identity role");
    }
    return roleId;
  }

  private UUID createdUserId(ResponseEntity<Void> response) {
    URI location = response.getHeaders().getLocation();
    if (location == null) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Identity provider did not return user id");
    }

    String path = location.getPath();
    String id = path.substring(path.lastIndexOf('/') + 1);
    return UUID.fromString(id);
  }

  private String trimTrailingSlash(String value) {
    String trimmed = URI.create(value.trim()).toString();
    return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
  }
}
