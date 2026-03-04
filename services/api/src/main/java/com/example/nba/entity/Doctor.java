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

  @Column(name = "whatsapp_number")
  private String whatsappNumber;

  @Column
  private String email;

  @Column(name = "target_product_focus")
  private String targetProductFocus;

  @Column(name = "availability_pattern")
  private String availabilityPattern;

  @Column(name = "availability_window")
  private String availabilityWindow;

  @Column(name = "scheduling_notes")
  private String schedulingNotes;

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

  public String getWhatsappNumber() { return whatsappNumber; }
  public void setWhatsappNumber(String whatsappNumber) { this.whatsappNumber = whatsappNumber; }

  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }

  public String getTargetProductFocus() { return targetProductFocus; }
  public void setTargetProductFocus(String targetProductFocus) { this.targetProductFocus = targetProductFocus; }

  public String getAvailabilityPattern() { return availabilityPattern; }
  public void setAvailabilityPattern(String availabilityPattern) { this.availabilityPattern = availabilityPattern; }

  public String getAvailabilityWindow() { return availabilityWindow; }
  public void setAvailabilityWindow(String availabilityWindow) { this.availabilityWindow = availabilityWindow; }

  public String getSchedulingNotes() { return schedulingNotes; }
  public void setSchedulingNotes(String schedulingNotes) { this.schedulingNotes = schedulingNotes; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
