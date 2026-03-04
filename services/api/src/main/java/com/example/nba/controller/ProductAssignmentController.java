package com.example.nba.controller;

import com.example.nba.dto.AssignUserProductsRequest;
import com.example.nba.dto.UserProductAssignmentResponse;
import com.example.nba.service.ProductAssignmentService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;

@RestController
public class ProductAssignmentController {
  private final ProductAssignmentService productAssignmentService;

  public ProductAssignmentController(ProductAssignmentService productAssignmentService) {
    this.productAssignmentService = productAssignmentService;
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MR','ROLE_SALES_REP','ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/me/products")
  public List<UserProductAssignmentResponse> myProducts(@AuthenticationPrincipal Jwt jwt) {
    return productAssignmentService.listAssignedProducts(UUID.fromString(jwt.getSubject()));
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @GetMapping("/api/v1/users/{userId}/products")
  public List<UserProductAssignmentResponse> userProducts(@PathVariable UUID userId) {
    return productAssignmentService.listAssignedProducts(userId);
  }

  @PreAuthorize("hasAnyAuthority('ROLE_MANAGER','ROLE_ADMIN')")
  @PutMapping("/api/v1/users/{userId}/products")
  public List<UserProductAssignmentResponse> replaceAssignments(@PathVariable UUID userId,
                                                                @Valid @RequestBody AssignUserProductsRequest request,
                                                                @AuthenticationPrincipal Jwt jwt) {
    return productAssignmentService.replaceAssignments(userId, request, UUID.fromString(jwt.getSubject()));
  }
}
