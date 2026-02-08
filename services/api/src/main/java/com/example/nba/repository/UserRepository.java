package com.example.nba.repository;

import com.example.nba.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {
  @Query(value = """
      SELECT u.*
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = :role
      """, nativeQuery = true)
  List<User> findByRole(@Param("role") String role);

  Optional<User> findByEmail(String email);

  @Query(value = """
      SELECT u.id AS id,
             u.full_name AS fullName,
             u.email AS email,
             u.is_active AS active,
             r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = :role
      ORDER BY u.full_name
      """, nativeQuery = true)
  List<UserRoleView> findRoleViewByRole(@Param("role") String role);

  @Query(value = """
      SELECT u.id AS id,
             u.full_name AS fullName,
             u.email AS email,
             u.is_active AS active,
             r.name AS role
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = :userId
      """, nativeQuery = true)
  Optional<UserRoleView> findRoleViewByUserId(@Param("userId") UUID userId);

  interface UserRoleView {
    UUID getId();
    String getFullName();
    String getEmail();
    boolean getActive();
    String getRole();
  }
}
