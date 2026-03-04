package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "recommendations")
public class Recommendation {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "doctor_id", nullable = false, columnDefinition = "uuid")
  private UUID doctorId;

  @Column(name = "message_id", columnDefinition = "uuid")
  private UUID messageId;

  @Column(nullable = false, precision = 10, scale = 4)
  private BigDecimal score;

  @Column(nullable = false)
  private String explanation;

  @Column(name = "recommended_action")
  private String recommendedAction;

  @Column(name = "recommended_message")
  private String recommendedMessage;

  @Column(name = "recommended_pharmacy_id", columnDefinition = "uuid")
  private UUID recommendedPharmacyId;

  @Column(name = "recommended_pharmacy_name")
  private String recommendedPharmacyName;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }

  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }

  public UUID getDoctorId() { return doctorId; }
  public void setDoctorId(UUID doctorId) { this.doctorId = doctorId; }

  public UUID getMessageId() { return messageId; }
  public void setMessageId(UUID messageId) { this.messageId = messageId; }

  public BigDecimal getScore() { return score; }
  public void setScore(BigDecimal score) { this.score = score; }

  public String getExplanation() { return explanation; }
  public void setExplanation(String explanation) { this.explanation = explanation; }

  public String getRecommendedAction() { return recommendedAction; }
  public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }

  public String getRecommendedMessage() { return recommendedMessage; }
  public void setRecommendedMessage(String recommendedMessage) { this.recommendedMessage = recommendedMessage; }

  public UUID getRecommendedPharmacyId() { return recommendedPharmacyId; }
  public void setRecommendedPharmacyId(UUID recommendedPharmacyId) { this.recommendedPharmacyId = recommendedPharmacyId; }

  public String getRecommendedPharmacyName() { return recommendedPharmacyName; }
  public void setRecommendedPharmacyName(String recommendedPharmacyName) { this.recommendedPharmacyName = recommendedPharmacyName; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
