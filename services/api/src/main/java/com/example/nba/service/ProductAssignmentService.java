package com.example.nba.service;

import com.example.nba.dto.AssignUserProductsRequest;
import com.example.nba.dto.UserProductAssignmentResponse;
import com.example.nba.repository.UserRepository;
import java.sql.Date;
import java.sql.Types;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProductAssignmentService {
  private final NamedParameterJdbcTemplate jdbc;
  private final UserRepository userRepository;

  public ProductAssignmentService(NamedParameterJdbcTemplate jdbc, UserRepository userRepository) {
    this.jdbc = jdbc;
    this.userRepository = userRepository;
  }

  public List<UserProductAssignmentResponse> listAssignedProducts(UUID userId) {
    String sql = """
        SELECT p.id AS product_id,
               p.name AS product_name,
               p.code AS product_code,
               p.brand_name,
               p.manufacturer_type,
               p.is_active,
               upa.starts_on,
               upa.ends_on
        FROM user_product_assignments upa
        JOIN products p ON p.id = upa.product_id
        WHERE upa.user_id = :userId
          AND upa.starts_on <= CURRENT_DATE
          AND (upa.ends_on IS NULL OR upa.ends_on >= CURRENT_DATE)
        ORDER BY p.name
        """;
    return jdbc.query(sql, new MapSqlParameterSource("userId", userId), (rs, rowNum) ->
        new UserProductAssignmentResponse(
            UUID.fromString(rs.getString("product_id")),
            rs.getString("product_name"),
            rs.getString("product_code"),
            rs.getString("brand_name"),
            rs.getString("manufacturer_type"),
            rs.getBoolean("is_active"),
            rs.getDate("starts_on").toLocalDate(),
            rs.getDate("ends_on") == null ? null : rs.getDate("ends_on").toLocalDate()
        )
    );
  }

  @Transactional
  public List<UserProductAssignmentResponse> replaceAssignments(UUID userId, AssignUserProductsRequest request, UUID actorUserId) {
    if (!userRepository.existsById(userId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }

    jdbc.update("""
        UPDATE user_product_assignments
        SET ends_on = CURRENT_DATE
        WHERE user_id = :userId
          AND starts_on <= CURRENT_DATE
          AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
        """, new MapSqlParameterSource("userId", userId));

    for (UUID productId : request.productIds()) {
      MapSqlParameterSource params = new MapSqlParameterSource()
          .addValue("id", UUID.randomUUID(), Types.OTHER)
          .addValue("userId", userId, Types.OTHER)
          .addValue("productId", productId, Types.OTHER)
          .addValue("assignedByUserId", actorUserId, Types.OTHER)
          .addValue("startsOn", Date.valueOf(LocalDate.now()));
      jdbc.update("""
          INSERT INTO user_product_assignments (id, user_id, product_id, assigned_by_user_id, starts_on, ends_on, created_at)
          VALUES (:id, :userId, :productId, :assignedByUserId, :startsOn, NULL, CURRENT_TIMESTAMP)
          """, params);
    }
    return listAssignedProducts(userId);
  }
}
