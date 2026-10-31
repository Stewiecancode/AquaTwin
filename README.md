# AquaTwin — Municipal Water Operations

A functional hackathon MVP for **H1: Community Water Incidents Lose Ownership**. Built with React, TypeScript, Vite, Tailwind, Radix/shadcn-style components, Recharts, Leaflet, React Three Fiber, Express, Socket.IO, Zod, and Firebase adapters.

## Run locally

Requires Node.js 22+ (Node 24 recommended).

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173**. Choose a demonstration staff role or open the community portal. No Firebase credentials or physical hardware are needed for the local demonstration. Data persists in `.data/demo.json` across restarts.

```powershell
npm run build
npm test
```

## Implemented

- Responsive municipal operations dashboard with backend-derived KPIs, source labels, filters, sensor charts, and Socket.IO refresh.
- Ten-category sensor registry with registration, editing, calibration metadata, GPS, thresholds, detail charts, and saved model placement.
- Isolated leak simulator, configurable combined flow/pressure anomaly rules, notification centre, unique sessions, linked suspected-leak incidents, stop and reset actions.
- Public resident reporting with map/GPS, optional photo/contact, random reference and private tracking key.
- Ordered incident workflow: **Reported → Validated → Assigned → In Progress → Resolved → Verified → Closed**, plus supervisor reopening.
- Team assignment, repair notes, evidence, costs/materials, response targets, preventive tasks, and timestamped audit history.
- Interactive fictional infrastructure map and a township GLB viewer with transparent pipes, controller-driven water flow and L-01 leak effects.
- Historical charts, monthly/quarterly incident comparison, transparent inspection rules, and privacy-filtered CSV exports.
- Firebase Authentication token validation, backend role checks, and Firestore persistence when configured; loopback-only demo identities and a persistent local adapter by default.

**All seeded assets are fictional, all generated telemetry is SIMULATED, and loss values are estimates. An anomaly is a suspected leak requiring human verification.** No device-control endpoint exists.

## Documentation

- [Township viewer, manual controller startup and leak controls](docs/TOWNSHIP-CONTROLLER.md)

- [Setup, Firebase, demo walkthrough, deployment, and limits](docs/SETUP.md)
- [REST API and Socket.IO events](docs/API.md)
- [Database model and scaling path](docs/DATABASE.md)
- [Blender integration](docs/BLENDER.md)
- [Original project concept](docs/PROJECT-CONCEPT.md)

## Structure

```text
client/       React application, pages, reusable UI, charts, map, 3D viewer
server/       Express API, services, simulation loop, file/Firestore adapters
shared/       TypeScript domain types and Zod schemas
tests/        Isolated integration and rule tests
public/models/ Reserved Blender export location
docs/         Configuration, API, schema, deployment and model guidance
```

## Deployment and scope

`vercel.json` and `render.yaml` provide frontend/backend deployment configuration. Configure Firebase and provider secrets before deployment; no cloud project or hosted URL is created by this repository. Never put Admin credentials in frontend environment variables.

This MVP is intentionally **one municipality and one backend process**. Staff accounts/roles are provisioned through Firebase, while zones and teams use fixed demo identifiers. Before a real pilot, replace in-memory working-set synchronisation with paginated/transactional repositories, private object storage, operational retention policies, and per-device credentials. See the documented limits; this is not a claim of production readiness or regulatory certification.
