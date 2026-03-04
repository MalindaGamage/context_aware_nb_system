package com.example.nba.repository;

import com.example.nba.entity.UserSchedulePreference;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSchedulePreferenceRepository extends JpaRepository<UserSchedulePreference, UUID> {}
