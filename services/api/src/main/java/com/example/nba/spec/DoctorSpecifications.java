package com.example.nba.spec;

import com.example.nba.entity.Doctor;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class DoctorSpecifications {
  private DoctorSpecifications() {}

  public static Specification<Doctor> hasTier(String tier) {
    return (root, query, cb) -> tier == null ? null : cb.equal(root.get("tier"), tier);
  }

  public static Specification<Doctor> hasSpecialty(String specialty) {
    return (root, query, cb) -> specialty == null ? null : cb.equal(root.get("specialty"), specialty);
  }

  public static Specification<Doctor> hasTerritory(UUID territoryId) {
    return (root, query, cb) -> territoryId == null ? null : cb.equal(root.get("territoryId"), territoryId);
  }
}