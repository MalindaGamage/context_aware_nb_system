package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "scoring_config_versions")
public class ScoringConfigVersion {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false, unique = true)
  private int version;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, columnDefinition = "jsonb")
  private String weights;

  @Column(nullable = false, columnDefinition = "jsonb")
  private String messages;

  @Column(nullable = false, columnDefinition = "jsonb")
  private String segments;

  @Column(name = "is_active", nullable = false)
  private boolean active;

  @Column(name = "created_by_user_id", columnDefinition = "uuid")
  private UUID createdByUserId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public int getVersion() { return version; }
  public void setVersion(int version) { this.version = version; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getWeights() { return weights; }
  public void setWeights(String weights) { this.weights = weights; }

  public String getMessages() { return messages; }
  public void setMessages(String messages) { this.messages = messages; }

  public String getSegments() { return segments; }
  public void setSegments(String segments) { this.segments = segments; }

  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }

  public UUID getCreatedByUserId() { return createdByUserId; }
  public void setCreatedByUserId(UUID createdByUserId) { this.createdByUserId = createdByUserId; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
