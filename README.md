# Context-Aware Next Best Action Platform

A full-stack pharmaceutical field-force platform that combines territory management, doctor and pharmacy intelligence, offline-capable visit execution, pharmacy sales signals, and explainable next-best-action recommendations.

The system is designed for a realistic medical representative workflow:

1. Managers define territories, assign MRs, assign doctors, import pharmacies, and monitor coverage.
2. Sales reps capture pharmacy orders and product movement.
3. MRs review ranked next-best-action recommendations, plan visits, capture GPS and feedback, and sync offline work.
4. Managers and admins review performance, audit logs, recommendation explanations, and governance metrics.

## Architecture

```text
apps/web              React + Vite PWA
services/api          Spring Boot API, JWT resource server, Liquibase migrations
services/recommender  FastAPI recommendation engine
infra                 Docker Compose, Keycloak realm import, PostGIS database
contracts             OpenAPI contract
db                    Reference schema and seed SQL
```

Runtime topology:

```text
Browser PWA
  -> Spring Boot API :8080
      -> PostgreSQL/PostGIS :5432 inside Docker, exposed as :5433 by default
      -> Keycloak :8081
      -> FastAPI recommender :8000
```

## Tech Stack

- Frontend: React 18, Vite, TypeScript, React Router, PWA service worker.
- Backend API: Java 21, Spring Boot, Spring Security OAuth2 Resource Server, Liquibase.
- Recommendation service: Python FastAPI.
- Data: PostgreSQL with PostGIS.
- Identity: Keycloak realm import with demo users and realm roles.
- Deployment: Docker Compose for local orchestration.

## Prerequisites

- Docker Desktop
- Node.js 18+ and npm
- Java 21 and Maven, if building the API outside Docker
- PowerShell on Windows, or equivalent shell on Linux/macOS

## Quick Start

Start the backend stack:

```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build
```

Start the PWA:

```powershell
cd e:\context_aware_nb_system\apps\web
npm install
npm run dev
```

Open:

- Web app: `http://localhost:5173`
- API: `http://localhost:8080/api/v1`
- Keycloak admin: `http://localhost:8081`
- Recommender: `http://localhost:8000`
- API health: `http://localhost:8080/actuator/health`

## Demo Credentials

Keycloak admin:

```text
Username: admin
Password: admin
```

Application users:

```text
MR:        mr1 / password
Sales Rep: sales1 / password
Manager:   manager1 / password
Admin:     admin1 / password
```

Seeded user IDs are aligned between Keycloak and the database. `mr1` maps to `11111111-1111-1111-1111-111111111111`.

## Environment

Copy `.env.example` to `.env` when overriding Docker Compose defaults.

Important defaults:

```text
API_PORT=8080
RECOMMENDER_PORT=8000
KEYCLOAK_PORT=8081
POSTGRES_PORT=5433
POSTGRES_DB=nba
POSTGRES_USER=nba
POSTGRES_PASSWORD=nbapass
```

Frontend environment is in `apps/web/.env`:

```text
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_KEYCLOAK_URL=/kc
VITE_KEYCLOAK_REALM=nba
VITE_KEYCLOAK_CLIENT_ID=nba-api
```

Set `VITE_GOOGLE_MAPS_API_KEY` locally if you want Google Maps pharmacy import/search features.

## Core Workflows

### Territory Setup

Territories are the central ownership unit.

```text
MR -> Territory
Doctor -> Territory
Pharmacy -> Territory
```

Managers and admins can:

- Create territories from the Territory Management screen.
- Assign MRs directly on each territory card.
- Assign doctors from Doctor Directory or Admin Governance.
- Assign/import pharmacies from the Manager Dashboard pharmacy workflow.

Example:

```text
MR One -> Weeraketiya Area
Doctors near Weeraketiya -> Weeraketiya Area
Pharmacies near Weeraketiya -> Weeraketiya Area
```

Once all three are linked to the same territory, the MR sees the relevant doctors, pharmacies, and recommendations in their workspace.

### MR Workflow

1. Log in as `mr1`.
2. Open NBA Dashboard.
3. Review ranked recommended actions.
4. Use assigned-territory or nearby mode in Doctor Directory.
5. Create visits and attach GPS where appropriate.
6. Capture pharmacy feedback for product movement signals.
7. Submit recommendation feedback as `DONE`, `SKIPPED`, or `RESCHEDULED`.
8. Sync queued offline work when connectivity returns.

### Sales Rep Workflow

1. Log in as `sales1`.
2. Open Sales Dashboard.
3. Select assigned pharmacy/product context.
4. Capture pharmacy orders.
5. Manager analytics and recommender signals use the resulting sales activity.

### Manager Workflow

1. Log in as `manager1`.
2. Create and assign territories.
3. Assign MRs, doctors, pharmacies, and products.
4. Import Google Maps pharmacies into selected territories.
5. Review sales trends, coverage, MR compliance, coaching insights, and targets.

### Admin Workflow

1. Log in as `admin1`.
2. Manage users, managers, sales reps, scoring configs, audit logs, products, and governance views.
3. Review recommendation logs and evaluation summaries.

## Local Development

Build the web app:

```powershell
cd e:\context_aware_nb_system\apps\web
npm run build
```

Build the API locally:

```powershell
cd e:\context_aware_nb_system\services\api
mvn "-Dmaven.repo.local=e:\Restrata\.m2" -DskipTests package
```

Compile-check the recommender:

```powershell
cd e:\context_aware_nb_system
python -m py_compile services/recommender/main.py
```

Rebuild a single service:

```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api
docker compose up -d --build recommender
docker compose up -d --build postgres
```

Rebuild the full stack:

```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build
```

View service status and logs:

```powershell
cd e:\context_aware_nb_system\infra
docker compose ps
docker logs nba-api --tail 100
docker logs nba-recommender --tail 100
docker logs nba-postgres --tail 100
docker logs nba-keycloak --tail 100
```

## Database And Migrations

Liquibase runs automatically when the API starts. Migrations live in:

```text
services/api/src/main/resources/db/changelog
```

The master changelog is:

```text
services/api/src/main/resources/db/changelog/db.changelog-master.xml
```

When adding schema or seed data:

1. Create the next numbered SQL file.
2. Add it to `db.changelog-master.xml`.
3. Make inserts idempotent with `WHERE NOT EXISTS` or conflict-safe logic.
4. Rebuild/restart the API so Liquibase applies it.

```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api
```

Fresh database reset, destructive:

```powershell
cd e:\context_aware_nb_system\infra
docker compose down -v
docker compose up -d --build
```

This deletes the PostgreSQL Docker volume and all local data.

## Seeded Data Highlights

The demo database includes:

- Core roles: `MR`, `SALES_REP`, `MANAGER`, `ADMIN`.
- Demo users and Keycloak realm mappings.
- Colombo Central territory.
- Walasmulla Area territory assigned to `MR One`.
- Demo doctors, pharmacies, products, visits, pharmacy orders, pharmacy feedback, and recommendation feedback.
- Product assignments and sales targets for manager/sales workflows.

Additional territories can be created from the UI.

## API Map

Representative secured endpoints:

```text
GET    /api/v1/territories
POST   /api/v1/territories
PUT    /api/v1/territories/{territoryId}
DELETE /api/v1/territories/{territoryId}

GET    /api/v1/users/me/territories
POST   /api/v1/users/{userId}/territories
DELETE /api/v1/users/{userId}/territories/{territoryId}

GET    /api/v1/doctors
GET    /api/v1/doctors/nearby
POST   /api/v1/doctors
PUT    /api/v1/doctors/{id}
PUT    /api/v1/doctors/{id}/territory

GET    /api/v1/pharmacies
GET    /api/v1/pharmacies/nearby
POST   /api/v1/pharmacies
POST   /api/v1/pharmacies/import-google
PUT    /api/v1/pharmacies/{pharmacyId}

POST   /api/v1/visits
GET    /api/v1/visits
PUT    /api/v1/visits/{visitId}
POST   /api/v1/visits/{visitId}/gps

GET    /api/v1/nba/next
POST   /api/v1/recommendations/{recommendationId}/feedback
POST   /api/v1/sync/batch

POST   /api/v1/pharmacy-orders
POST   /api/v1/pharmacy-feedback
GET    /api/v1/analytics/sales
GET    /api/v1/analytics/manager
GET    /api/v1/analytics/territories
```

Authorization is role-based through Keycloak realm roles and Spring `@PreAuthorize` checks.

## Recommendation Engine

The recommender uses:

- Doctor profile and priority data.
- Territory and proximity context.
- Visit recency and feedback.
- Product assignment.
- Pharmacy sales and sell-out signals.
- Recent pharmacy feedback.
- Schedule preferences.

Returned recommendations include ranked doctors, score, drivers, explanation text, recommended action, and recommended message. Pharmacy-first context is currently represented through recommendation text and drivers.

## Offline And PWA Behavior

The web client supports:

- PWA installability.
- Cached NBA snapshots.
- IndexedDB-backed offline queue for visits and recommendation feedback.
- Sync conflict reporting.
- Session expiry handling for stale JWTs.

If the browser keeps showing stale UI after a build, hard-refresh the app or unregister the service worker from DevTools.

## Troubleshooting

### 401 Unauthorized

Most local 401s are caused by expired access tokens. Log out and log in again. Access tokens are short-lived in the demo Keycloak realm.

Check API logs:

```powershell
docker logs nba-api --tail 100
```

### API Cannot Validate JWT

Verify Keycloak is running and the API has the correct issuer/JWK settings:

```text
JWT_ISSUER_URI=http://host.docker.internal:8081/realms/nba
SECURITY_JWT_JWK_SET_URI=http://keycloak:8080/realms/nba/protocol/openid-connect/certs
```

### Liquibase Did Not Apply A Migration

Rebuild/restart the API:

```powershell
cd e:\context_aware_nb_system\infra
docker compose up -d --build api
```

Then check logs:

```powershell
docker logs nba-api --tail 150
```

### Docker Permission Errors On Windows

Run Docker Desktop and use a shell with permission to access the Docker named pipe. Some operations may require elevated privileges depending on local Docker configuration.

### Port Conflicts

Defaults:

```text
5173 web dev server
8080 API
8081 Keycloak
8000 recommender
5433 Postgres host port
```

Change ports through `.env` and restart Docker Compose.

## Validation Checklist

Use this after meaningful changes:

```powershell
cd e:\context_aware_nb_system\apps\web
npm run build
```

```powershell
cd e:\context_aware_nb_system\services\api
mvn "-Dmaven.repo.local=e:\Restrata\.m2" -DskipTests package
```

```powershell
cd e:\context_aware_nb_system
python -m py_compile services/recommender/main.py
```

```powershell
cd e:\context_aware_nb_system\infra
docker compose ps
```

## Dissertation Objective Coverage

Implemented software support:

- Doctor, visit, territory, schedule, GPS, pharmacy, sales, feedback, and product-assignment domains.
- PostGIS-backed proximity queries for doctors and pharmacies.
- Role-based access control for MR, sales rep, manager, and admin workflows.
- Explainable recommendation factors and recommendation feedback.
- Offline queueing and sync conflict handling.
- Manager/admin evaluation and governance endpoints.

Research work still required outside the codebase:

- Formal stakeholder elicitation and documented needs analysis.
- Controlled offline simulation and user-centred evaluation methodology.
- Dissertation chapters covering architecture, algorithm design, experiments, findings, limitations, and future work.

## Repository Hygiene

- Keep migrations append-only after they have been applied to shared databases.
- Prefer idempotent seed scripts.
- Do not commit real API keys or production credentials.
- Keep role-sensitive features behind backend authorization, not only frontend navigation.
- Validate frontend, API, and recommender changes before rebuilding Docker images.
