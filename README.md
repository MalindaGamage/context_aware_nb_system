# Context-Aware Next Best Action (NBA)

Scaffold for the Context-Aware NBA platform.

Structure:
- `services/api` Spring Boot API (JWT/OAuth2 resource server)
- `services/recommender` FastAPI recommendation service
- `apps/web` PWA client (React + Vite)
- `db` reference schema + seed data
- `contracts` OpenAPI contracts
- `infra` docker-compose + Keycloak realm import

Local dev (Sprint 1)
1) Start dependencies and services
```
cd infra
docker compose up --build
```

2) API base URL: `http://localhost:8080/api/v1`

3) Keycloak admin: `http://localhost:8081`
- user: `admin`
- pass: `admin`

Demo users (Keycloak + DB IDs aligned)
- MR: `mr1 / password`
- Sales Rep: `sales1 / password`
- Manager: `manager1 / password`
- Admin: `admin1 / password`

PWA
```
cd apps/web
npm install
npm run dev
```

Notes
- Liquibase runs on API startup using `services/api/src/main/resources/db/changelog`.
- PostGIS is enabled by default (see `services/api/src/main/resources/db/changelog/001_schema.sql`).

Objective coverage snapshot
- `PA1 / PO1.2 / PO1.3`: doctors, visits, territories, schedules, GPS, and proximity queries are implemented in the Spring API with PostgreSQL/PostGIS.
- `PO1.4`: the recommender now returns ranked doctors plus explicit `recommendedAction` and `recommendedMessage`, not just a score.
- `PO1.5`: the web client is a mobile-first PWA with offline queueing, cached NBA snapshots, and sync conflict handling.
- `PA2 / PO2.1 / PO2.2 / PO2.4`: explanations, factor-level drivers, override/feedback capture, RBAC, audit logging, and privacy-aware location handling are implemented.
- `PO2.3`: manager/admin evaluation metrics are exposed through `/api/v1/admin/evaluation-summary` and governance screens.

Remaining gaps that still need dissertation work rather than code alone
- `PO1.1`: stakeholder elicitation and formalized needs still require interviews/workshops and documented findings.
- `PO2.3`: offline simulation and user-centred assessment methodology still need experiment design, datasets, and analysis write-up.
- `PO2.5`: dissertation-quality architecture, algorithm, experiment, result, and limitation chapters still need to be written.


Use these from [`infra/docker-compose.yml`](/e:/context_aware_nb_system/infra/docker-compose.yml).

If you changed only the recommender:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build recommender
```

If you changed only the API:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api
```

If you changed both API and recommender:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api recommender
```

If you changed Postgres init/config or want to recreate the DB container:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build postgres
```

If you changed Liquibase migrations in the API, rebuild the API service:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api
```

Useful checks:
```powershell
docker compose ps
docker logs nba-api --tail 100
docker logs nba-recommender --tail 100
docker logs nba-postgres --tail 100
```

If you need a full stack rebuild:
```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build
```

If you want a clean recreate of one service:
```powershell
docker compose up -d --build --force-recreate api
docker compose up -d --build --force-recreate recommender
docker compose up -d --build --force-recreate postgres
```

Important note for Postgres:
- schema/data usually persist in the Docker volume
- if you want a completely fresh database, that is destructive:
```powershell
docker compose down -v
docker compose up -d --build
```

That deletes existing DB data.

End-to-End Flow

Log in as manager and open the manager dashboard.
Check Pharmacy Sales Trends and SR Weekly Targets to confirm seeded sales data is visible.
Assign any extra Google Maps pharmacies to the Colombo territory if you want to extend the scenario.
Log in as sales1 and record a few new pharmacy orders for assigned products.
Log in as mr1 and open /mr.
Review the NBA list:
cardio-focused doctors should surface top-pharmacy-driven actions
GlucoSure/Metformin doctors should surface doctor revisit actions after poor sell-out
In the MR pharmacy feedback section, capture fresh feedback from a pharmacy for a low-selling product.
Refresh recommendations and confirm the action shifts toward Meet Doctor Again.
Submit recommendation feedback as Done, Skipped, or Rescheduled.
Return to manager view and verify trends, coaching, and target-vs-actual changed accordingly.
What to look for

Doctors linked to strong CardioPlus sell-out should mention a best-performing pharmacy.
Doctors linked to weak GlucoSure sell-out should recommend a doctor revisit.
Explanations should now include sales-trend and pharmacy-performance drivers.
If you want, next I can add a dedicated recommended_pharmacy_id/name field to the recommendation API so the UI can show pharmacy-first recommendations as first-class destination cards instead of only text actions.