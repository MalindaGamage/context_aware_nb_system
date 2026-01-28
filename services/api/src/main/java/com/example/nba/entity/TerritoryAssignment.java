package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "territory_assignments")
public class TerritoryAssignment {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "territory_id", nullable = false, columnDefinition = "uuid")
  private UUID territoryId;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "starts_on", nullable = false)
  private LocalDate startsOn;

  @Column(name = "ends_on")
  private LocalDate endsOn;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getTerritoryId() { return territoryId; }
  public void setTerritoryId(UUID territoryId) { this.territoryId = territoryId; }

  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }

  public LocalDate getStartsOn() { return startsOn; }
  public void setStartsOn(LocalDate startsOn) { this.startsOn = startsOn; }

  public LocalDate getEndsOn() { return endsOn; }
  public void setEndsOn(LocalDate endsOn) { this.endsOn = endsOn; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}