package com.example.nba.service;

import com.example.nba.dto.CreateProductRequest;
import com.example.nba.dto.ProductSummaryResponse;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
               p.code,
               COALESCE(NULLIF(TRIM(p.description), ''), 'General') AS category,
               p.brand_name,
               p.manufacturer_type,
               p.is_active AS active,
               COALESCE(COUNT(DISTINCT r.doctor_id), 0) AS assigned_doctors
        FROM products p
        LEFT JOIN messages m ON m.product_id = p.id
        LEFT JOIN recommendations r ON r.message_id = m.id
        GROUP BY p.id, p.name, p.code, p.description, p.brand_name, p.manufacturer_type, p.is_active
        ORDER BY p.name
        """;

    return jdbc.query(sql, (rs, rowNum) -> new ProductSummaryResponse(
        UUID.fromString(rs.getString("id")),
        rs.getString("name"),
        rs.getString("code"),
        rs.getString("category"),
        rs.getString("brand_name"),
        rs.getString("manufacturer_type"),
        rs.getBoolean("active"),
        rs.getLong("assigned_doctors")
    ));
  }

  @Transactional
  public ProductSummaryResponse createProduct(CreateProductRequest request) {
    String code = normalizeCode(request.code());
    if (productCodeExists(code, null)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Product code already exists");
    }

    UUID id = UUID.randomUUID();
    jdbc.update("""
        INSERT INTO products (id, name, code, description, brand_name, manufacturer_type, is_active, created_at)
        VALUES (:id, :name, :code, :description, :brandName, :manufacturerType, :active, NOW())
        """, new MapSqlParameterSource()
        .addValue("id", id)
        .addValue("name", request.name().trim())
        .addValue("code", code)
        .addValue("description", trimToNull(request.description()))
        .addValue("brandName", trimToNull(request.brandName()))
        .addValue("manufacturerType", normalizeOptionalCode(request.manufacturerType()))
        .addValue("active", request.active()));
    return getProduct(id);
  }

  @Transactional
  public ProductSummaryResponse updateProduct(UUID productId, CreateProductRequest request) {
    ensureProductExists(productId);
    String code = normalizeCode(request.code());
    if (productCodeExists(code, productId)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Product code already exists");
    }

    jdbc.update("""
        UPDATE products
        SET name = :name,
            code = :code,
            description = :description,
            brand_name = :brandName,
            manufacturer_type = :manufacturerType,
            is_active = :active
        WHERE id = :id
        """, new MapSqlParameterSource()
        .addValue("id", productId)
        .addValue("name", request.name().trim())
        .addValue("code", code)
        .addValue("description", trimToNull(request.description()))
        .addValue("brandName", trimToNull(request.brandName()))
        .addValue("manufacturerType", normalizeOptionalCode(request.manufacturerType()))
        .addValue("active", request.active()));
    return getProduct(productId);
  }

  private ProductSummaryResponse getProduct(UUID productId) {
    String sql = """
        SELECT p.id,
               p.name,
               p.code,
               COALESCE(NULLIF(TRIM(p.description), ''), 'General') AS category,
               p.brand_name,
               p.manufacturer_type,
               p.is_active AS active,
               COALESCE(COUNT(DISTINCT r.doctor_id), 0) AS assigned_doctors
        FROM products p
        LEFT JOIN messages m ON m.product_id = p.id
        LEFT JOIN recommendations r ON r.message_id = m.id
        WHERE p.id = :id
        GROUP BY p.id, p.name, p.code, p.description, p.brand_name, p.manufacturer_type, p.is_active
        """;
    List<ProductSummaryResponse> rows = jdbc.query(sql, Map.of("id", productId), (rs, rowNum) -> new ProductSummaryResponse(
        UUID.fromString(rs.getString("id")),
        rs.getString("name"),
        rs.getString("code"),
        rs.getString("category"),
        rs.getString("brand_name"),
        rs.getString("manufacturer_type"),
        rs.getBoolean("active"),
        rs.getLong("assigned_doctors")
    ));
    if (rows.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
    }
    return rows.get(0);
  }

  private void ensureProductExists(UUID productId) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE id = :id", Map.of("id", productId), Integer.class);
    if (count == null || count == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
    }
  }

  private boolean productCodeExists(String code, UUID excludingProductId) {
    String sql = excludingProductId == null
        ? "SELECT COUNT(*) FROM products WHERE code = :code"
        : "SELECT COUNT(*) FROM products WHERE code = :code AND id <> :id";
    Map<String, ?> params = excludingProductId == null ? Map.of("code", code) : Map.of("code", code, "id", excludingProductId);
    Integer count = jdbc.queryForObject(sql, params, Integer.class);
    return count != null && count > 0;
  }

  private String normalizeCode(String value) {
    return value.trim().toUpperCase(Locale.ROOT);
  }

  private String normalizeOptionalCode(String value) {
    String trimmed = trimToNull(value);
    return trimmed == null ? null : trimmed.toUpperCase(Locale.ROOT);
  }

  private String trimToNull(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
