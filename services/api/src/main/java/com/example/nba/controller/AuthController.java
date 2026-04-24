package com.example.nba.controller;

import com.example.nba.dto.RegisterUserRequest;
import com.example.nba.dto.RegisterUserResponse;
import com.example.nba.dto.UserProfileResponse;
import com.example.nba.service.KeycloakRegistrationService;
import com.example.nba.service.UserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
  private final KeycloakRegistrationService keycloakRegistrationService;
  private final UserService userService;

  public AuthController(KeycloakRegistrationService keycloakRegistrationService, UserService userService) {
    this.keycloakRegistrationService = keycloakRegistrationService;
    this.userService = userService;
  }

  @PostMapping("/api/v1/auth/register")
  public RegisterUserResponse register(@Valid @RequestBody RegisterUserRequest request) {
    UUID userId = keycloakRegistrationService.createUser(request);
    try {
      UserProfileResponse user = userService.createRegisteredUser(
          userId,
          request.fullName(),
          request.email(),
          request.role());
      return new RegisterUserResponse(user.id(), request.username().trim(), user.email(), user.fullName(), user.role());
    } catch (RuntimeException ex) {
      keycloakRegistrationService.deleteUser(userId);
      throw ex;
    }
  }
}
