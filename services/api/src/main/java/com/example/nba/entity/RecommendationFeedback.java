package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendation_feedback")
public class RecommendationFeedback {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "recommendation_id", nullable = false, columnDefinition = "uuid")
  private UUID recommendationId;

  @Column(name = "created_by_user_id", nullable = false, columnDefinition = "uuid")
  private UUID createdByUserId;

  @Column(nullable = false)
  private String status;

  @Column
  private String reason;

  @Column(name = "override_doctor_id", columnDefinition = "uuid")
  private UUID overrideDoctorId;

  @Column(name = "rescheduled_to")
  private OffsetDateTime rescheduledTo;

  @Column(name = "override_notes")
  private String overrideNotes;

  @Column(name = "client_reference_id")
  private String clientReferenceId;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getRecommendationId() { return recommendationId; }
  public void setRecommendationId(UUID recommendationId) { this.recommendationId = recommendationId; }

  public UUID getCreatedByUserId() { return createdByUserId; }
  public void setCreatedByUserId(UUID createdByUserId) { this.createdByUserId = createdByUserId; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }

  public String getReason() { return reason; }
  public void setReason(String reason) { this.reason = reason; }

  public UUID getOverrideDoctorId() { return overrideDoctorId; }
  public void setOverrideDoctorId(UUID overrideDoctorId) { this.overrideDoctorId = overrideDoctorId; }

  public OffsetDateTime getRescheduledTo() { return rescheduledTo; }
  public void setRescheduledTo(OffsetDateTime rescheduledTo) { this.rescheduledTo = rescheduledTo; }

  public String getOverrideNotes() { return overrideNotes; }
  public void setOverrideNotes(String overrideNotes) { this.overrideNotes = overrideNotes; }

  public String getClientReferenceId() { return clientReferenceId; }
  public void setClientReferenceId(String clientReferenceId) { this.clientReferenceId = clientReferenceId; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}