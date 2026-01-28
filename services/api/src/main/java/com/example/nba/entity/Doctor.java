package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "doctors")
public class Doctor {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column
  private String specialty;

  @Column(nullable = false)
  private String tier;

  @Column(name = "priority_score", nullable = false)
  private int priorityScore;

  @Column(columnDefinition = "geometry(POINT,4326)")
  private Point location;

  @Column(name = "territory_id", columnDefinition = "uuid")
  private UUID territoryId;

  @Column
  private String notes;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public String getFullName() { return fullName; }
  public void setFullName(String fullName) { this.fullName = fullName; }

  public String getSpecialty() { return specialty; }
  public void setSpecialty(String specialty) { this.specialty = specialty; }

  public String getTier() { return tier; }
  public void setTier(String tier) { this.tier = tier; }

  public int getPriorityScore() { return priorityScore; }
  public void setPriorityScore(int priorityScore) { this.priorityScore = priorityScore; }

  public Point getLocation() { return location; }
  public void setLocation(Point location) { this.location = location; }

  public UUID getTerritoryId() { return territoryId; }
  public void setTerritoryId(UUID territoryId) { this.territoryId = territoryId; }

  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}