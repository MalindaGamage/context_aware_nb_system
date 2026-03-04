package com.example.nba.service;

import com.example.nba.dto.NbaNextResponse;
import com.example.nba.dto.NbaRecommendationResponse;
import com.example.nba.dto.RecommendationFactorResponse;
import com.example.nba.dto.RecommenderItem;
import com.example.nba.dto.RecommenderFactor;
import com.example.nba.entity.Doctor;
import com.example.nba.entity.Recommendation;
import com.example.nba.entity.RecommendationFactor;
import com.example.nba.repository.DoctorRepository;
import com.example.nba.repository.RecommendationFactorRepository;
import com.example.nba.repository.RecommendationRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecommendationService {
  private final RecommendationRepository recommendationRepository;
  private final RecommendationFactorRepository recommendationFactorRepository;
  private final DoctorRepository doctorRepository;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final String recommenderBaseUrl;
  private final Duration recommenderTimeout;

  public RecommendationService(RecommendationRepository recommendationRepository,
                               RecommendationFactorRepository recommendationFactorRepository,
                               DoctorRepository doctorRepository,
                               ObjectMapper objectMapper,
                               @Value("${recommender.base-url:http://localhost:8000}") String recommenderBaseUrl,
                               @Value("${recommender.timeout-ms:1800}") long recommenderTimeoutMs) {
    this.recommendationRepository = recommendationRepository;
    this.recommendationFactorRepository = recommendationFactorRepository;
    this.doctorRepository = doctorRepository;
    this.objectMapper = objectMapper;
    this.recommenderBaseUrl = recommenderBaseUrl;
    this.recommenderTimeout = Duration.ofMillis(Math.max(200, recommenderTimeoutMs));
    this.httpClient = HttpClient.newBuilder().connectTimeout(this.recommenderTimeout).build();
  }

  @Transactional
  public NbaNextResponse nextBestActions(UUID userId, int limit) {
    List<RecommenderItem> scored = fetchFromRecommender(userId, limit);
    if (scored.isEmpty()) {
      return new NbaNextResponse(List.of());
    }

    OffsetDateTime now = OffsetDateTime.now();
    List<Recommendation> persisted = new ArrayList<>();
    List<RecommendationFactor> persistedFactors = new ArrayList<>();

    for (RecommenderItem item : scored) {
      Recommendation recommendation = new Recommendation();
      recommendation.setId(UUID.randomUUID());
      recommendation.setUserId(userId);
      recommendation.setDoctorId(item.doctor_id());
      recommendation.setMessageId(null);
      recommendation.setScore(BigDecimal.valueOf(item.score()));
      recommendation.setExplanation(item.explanation());
      recommendation.setRecommendedAction(item.recommended_action());
      recommendation.setRecommendedMessage(item.recommended_message());
      recommendation.setRecommendedPharmacyId(item.recommended_pharmacy_id());
      recommendation.setRecommendedPharmacyName(item.recommended_pharmacy_name());
      recommendation.setCreatedAt(now);
      persisted.add(recommendation);

      if (item.factors() != null) {
        for (RecommenderFactor factor : item.factors()) {
          RecommendationFactor entity = new RecommendationFactor();
          entity.setId(UUID.randomUUID());
          entity.setRecommendationId(recommendation.getId());
          entity.setFactorKey(factor.key());
          entity.setFactorValue(factor.value());
          entity.setContribution(BigDecimal.valueOf(factor.contribution()));
          entity.setCreatedAt(now);
          persistedFactors.add(entity);
        }
      }
    }

    recommendationRepository.saveAll(persisted);
    recommendationFactorRepository.saveAll(persistedFactors);

    Map<UUID, Doctor> doctorsById = doctorRepository.findAllById(
            persisted.stream().map(Recommendation::getDoctorId).collect(Collectors.toSet()))
        .stream()
        .collect(Collectors.toMap(Doctor::getId, doctor -> doctor));

    Map<UUID, List<RecommendationFactorResponse>> driversByRecommendation = persistedFactors.stream()
        .collect(Collectors.groupingBy(
            RecommendationFactor::getRecommendationId,
            LinkedHashMap::new,
            Collectors.mapping(
                factor -> new RecommendationFactorResponse(
                    factor.getFactorKey(),
                    factor.getFactorValue(),
                    factor.getContribution().doubleValue()),
                Collectors.toList()
            )));

    List<NbaRecommendationResponse> responseItems = new ArrayList<>();
    for (Recommendation recommendation : persisted) {
      Doctor doctor = doctorsById.get(recommendation.getDoctorId());
      responseItems.add(new NbaRecommendationResponse(
          recommendation.getId(),
          recommendation.getDoctorId(),
          doctor != null ? doctor.getFullName() : "Unknown Doctor",
          doctor != null ? doctor.getSpecialty() : null,
          doctor != null ? doctor.getTier() : null,
          doctor != null ? doctor.getPriorityScore() : 0,
          recommendation.getScore().doubleValue(),
          recommendation.getExplanation(),
          recommendation.getRecommendedAction(),
          recommendation.getRecommendedMessage(),
          recommendation.getRecommendedPharmacyId(),
          recommendation.getRecommendedPharmacyName(),
          driversByRecommendation.getOrDefault(recommendation.getId(), List.of())
      ));
    }

    responseItems.sort((left, right) -> Double.compare(right.score(), left.score()));
    return new NbaNextResponse(responseItems);
  }

  private List<RecommenderItem> fetchFromRecommender(UUID userId, int limit) {
    String encodedUserId = URLEncoder.encode(userId.toString(), StandardCharsets.UTF_8);
    URI uri = URI.create(String.format(
        "%s/v1/recommendations?user_id=%s&limit=%d",
        stripTrailingSlash(recommenderBaseUrl),
        encodedUserId,
        limit));

    HttpRequest request = HttpRequest.newBuilder(uri)
        .timeout(recommenderTimeout)
        .GET()
        .build();

    try {
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() >= 400) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Recommender service returned an error");
      }
      return objectMapper.readValue(response.body(), new TypeReference<>() {});
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Recommender service unavailable", ex);
    }
  }

  private String stripTrailingSlash(String value) {
    if (value.endsWith("/")) {
      return value.substring(0, value.length() - 1);
    }
    return value;
  }
}
