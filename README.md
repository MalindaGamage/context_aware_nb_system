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