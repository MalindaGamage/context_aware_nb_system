package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "visits")
public class Visit {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "doctor_id", nullable = false, columnDefinition = "uuid")
  private UUID doctorId;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "visit_time", nullable = false)
  private OffsetDateTime visitTime;

  @Column(nullable = false)
  private String outcome;

  @Column
  private String notes;

  @Column(name = "follow_up_required", nullable = false)
  private boolean followUpRequired;

  @Column(name = "client_reference_id")
  private String clientReferenceId;

  @Column(columnDefinition = "geometry(POINT,4326)")
  private Point location;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getDoctorId() { return doctorId; }
  public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }

  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }

  public OffsetDateTime getVisitTime() { return visitTime; }
  public void setVisitTime(OffsetDateTime visitTime) { this.visitTime = visitTime; }

  public String getOutcome() { return outcome; }
  public void setOutcome(String outcome) { this.outcome = outcome; }

  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }

  public boolean isFollowUpRequired() { return followUpRequired; }
  public void setFollowUpRequired(boolean followUpRequired) { this.followUpRequired = followUpRequired; }

  public String getClientReferenceId() { return clientReferenceId; }
  public void setClientReferenceId(String clientReferenceId) { this.clientReferenceId = clientReferenceId; }

  public Point getLocation() { return location; }
  public void setLocation(Point location) { this.location = location; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
