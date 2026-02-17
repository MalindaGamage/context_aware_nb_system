package com.example.nba.service;

import com.example.nba.dto.ProductSummaryResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ProductService {
  private final NamedParameterJdbcTemplate jdbc;

  public ProductService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<ProductSummaryResponse> listProducts() {
    String sql = """
        SELECT p.id,
               p.name,
               COALESCE(NULLIF(TRIM(p.description), ''), 'General') AS category,
               CASE WHEN p.code ILIKE '%INACTIVE%' THEN FALSE ELSE TRUE END AS active,
               COALESCE(COUNT(DISTINCT r.doctor_id), 0) AS assigned_doctors
        FROM products p
        LEFT JOIN messages m ON m.product_id = p.id
        LEFT JOIN recommendations r ON r.message_id = m.id
        GROUP BY p.id, p.name, p.description, p.code
        ORDER BY p.name
        """;

    return jdbc.query(sql, (rs, rowNum) -> new ProductSummaryResponse(
        UUID.fromString(rs.getString("id")),
        rs.getString("name"),
        rs.getString("category"),
        rs.getBoolean("active"),
        rs.getLong("assigned_doctors")
    ));
  }
}
