package com.example.nba.repository;

import com.example.nba.entity.UserRole;
import com.example.nba.entity.UserRoleId;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {
  void deleteByIdUserId(UUID userId);
}
