package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendation_factors")
public class RecommendationFactor {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "recommendation_id", nullable = false, columnDefinition = "uuid")
  private UUID recommendationId;

  @Column(name = "factor_key", nullable = false)
  private String factorKey;

  @Column(name = "factor_value", nullable = false)
  private String factorValue;

  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal contribution;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getRecommendationId() { return recommendationId; }
  public void setRecommendationId(UUID recommendationId) { this.recommendationId = recommendationId; }

  public String getFactorKey() { return factorKey; }
  public void setFactorKey(String factorKey) { this.factorKey = factorKey; }

  public String getFactorValue() { return factorValue; }
  public void setFactorValue(String factorValue) { this.factorValue = factorValue; }

  public BigDecimal getContribution() { return contribution; }
  public void setContribution(BigDecimal contribution) { this.contribution = contribution; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}