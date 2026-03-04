package com.example.nba.spec;

import com.example.nba.entity.Pharmacy;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class PharmacySpecifications {
  private PharmacySpecifications() {}

  public static Specification<Pharmacy> hasTerritory(UUID territoryId) {
    return (root, query, cb) -> territoryId == null ? null : cb.equal(root.get("territoryId"), territoryId);
  }

  public static Specification<Pharmacy> inTerritories(Collection<UUID> territoryIds) {
    return (root, query, cb) -> territoryIds == null ? null : root.get("territoryId").in(territoryIds);
  }
}
