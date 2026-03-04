package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_schedule_preferences")
public class UserSchedulePreference {
  @Id
  @Column(name = "user_id", columnDefinition = "uuid")
  private UUID userId;

  @Column(name = "workday_start", nullable = false)
  private LocalTime workdayStart;

  @Column(name = "workday_end", nullable = false)
  private LocalTime workdayEnd;

  @Column(name = "break_start")
  private LocalTime breakStart;

  @Column(name = "break_end")
  private LocalTime breakEnd;

  @Column(name = "max_visits_per_day", nullable = false)
  private Integer maxVisitsPerDay;

  @Column(name = "base_location_text")
  private String baseLocationText;

  @Column(name = "planning_notes")
  private String planningNotes;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  public UUID getUserId() { return userId; }
  public void setUserId(UUID userId) { this.userId = userId; }

  public LocalTime getWorkdayStart() { return workdayStart; }
  public void setWorkdayStart(LocalTime workdayStart) { this.workdayStart = workdayStart; }

  public LocalTime getWorkdayEnd() { return workdayEnd; }
  public void setWorkdayEnd(LocalTime workdayEnd) { this.workdayEnd = workdayEnd; }

  public LocalTime getBreakStart() { return breakStart; }
  public void setBreakStart(LocalTime breakStart) { this.breakStart = breakStart; }

  public LocalTime getBreakEnd() { return breakEnd; }
  public void setBreakEnd(LocalTime breakEnd) { this.breakEnd = breakEnd; }

  public Integer getMaxVisitsPerDay() { return maxVisitsPerDay; }
  public void setMaxVisitsPerDay(Integer maxVisitsPerDay) { this.maxVisitsPerDay = maxVisitsPerDay; }

  public String getBaseLocationText() { return baseLocationText; }
  public void setBaseLocationText(String baseLocationText) { this.baseLocationText = baseLocationText; }

  public String getPlanningNotes() { return planningNotes; }
  public void setPlanningNotes(String planningNotes) { this.planningNotes = planningNotes; }

  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
