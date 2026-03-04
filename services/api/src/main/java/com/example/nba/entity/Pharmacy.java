package com.example.nba.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "pharmacies")
public class Pharmacy {
  @Id
  @Column(columnDefinition = "uuid")
  private UUID id;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(name = "google_place_id", unique = true)
  private String googlePlaceId;

  @Column
  private String address;

  @Column(columnDefinition = "geometry(POINT,4326)")
  private Point location;

  @Column(name = "territory_id", columnDefinition = "uuid")
  private UUID territoryId;

  @Column(name = "contact_number")
  private String contactNumber;

  @Column
  private String notes;

  @Column(name = "created_at", nullable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;

  public UUID getId() { return id; }
  public void setId(UUID id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }
  public String getGooglePlaceId() { return googlePlaceId; }
  public void setGooglePlaceId(String googlePlaceId) { this.googlePlaceId = googlePlaceId; }
  public String getAddress() { return address; }
  public void setAddress(String address) { this.address = address; }
  public Point getLocation() { return location; }
  public void setLocation(Point location) { this.location = location; }
  public UUID getTerritoryId() { return territoryId; }
  public void setTerritoryId(UUID territoryId) { this.territoryId = territoryId; }
  public String getContactNumber() { return contactNumber; }
  public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }
  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
