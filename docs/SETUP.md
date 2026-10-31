# Setup, authentication, and deployment

## Local demonstration

Use Node.js 22 or newer (Node 24 recommended).

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open http://127.0.0.1:5173. The API listens on http://127.0.0.1:4000. Use **127.0.0.1**, not localhost, to match the configured browser origin. The demo login explicitly selects administrator, operator, or technician. These are demonstration identities, not production credentials. Demo mode binds only to loopback and must not be exposed through a public tunnel.

The default demo store is `.data/demo.json`, written through an atomic replacement and a serial write queue. It survives server restarts. Do not commit it: it can contain resident contact information and photos. Run one backend process per store. Do not open the same file from several instances.

```powershell
npm run build
npm test
```

Tests use a separate temporary store and API port 4187. They exercise the full incident lifecycle, role restrictions, privacy, Socket.IO anomaly events, and restart persistence.

## Demonstration walkthrough

1. Enter the workspace as Administrator, or open `/community` to submit a report. Choose an actual map pin for your fictional demonstration and clearly describe it as a demo report.
2. Save the report reference and private tracking key. The key is returned only once; only its SHA-256 hash is stored.
3. In Incident management, open the report. Set zone and infrastructure association and **Validate report**.
4. Assign it to Team Alpha with a response target. Sign out and enter as Technician if you want to show team-restricted access.
5. Start the repair, add materials, costs, photographs, and resolution notes. Record resolution.
6. Enter as Administrator or Operator. Independently verify the repair and close the incident. The public tracking page exposes status timestamps only.
7. Click **Simulate water leak**. Select Main supply pipeline or Distribution branch B and a severity. The backend checks configurable flow/pressure thresholds every five seconds, creates a suspected-leak incident, emits an alert, and highlights mapped infrastructure.
8. Stop the simulation. Baseline telemetry returns on the next tick. The incident remains open for human verification.
9. Inspect Historical analytics and export reports. Reset the fictional network from Settings when finished.

Administrators can set each pipeline's nominal diameter and approximate safe flow/velocity limits in **Settings → Pipe capacity thresholds**. A flow above a configured limit marks its sensor critical; during simulation it also raises a suspected-leak incident.

| Nominal diameter | Common application | Maximum safe velocity | Approximate flow limit |
|---|---|---:|---:|
| DN15 | Individual basins, toilets, and sinks | 2.0 m/s | 20 L/min |
| DN20 | Main branches to bathrooms or kitchens | 2.0 m/s | 37 L/min |
| DN22 / DN25 | Small residential main entry lines | 2.0 m/s | 60 L/min |
| DN32 | Large residential mains / multi-bathroom feeds | 2.0 m/s | 100 L/min |
| DN40 | Small commercial / apartment sub-mains | 2.0 m/s | 150 L/min |
| DN50 | Commercial headers, irrigation manifolds, apartment risers | 2.0 m/s | 230 L/min |
| DN75–DN110+ | Municipal distribution, bulk water supply | 2.5–3.0 m/s (buried) | 600+ L/min |

The Settings page starts DN75 and DN110 at 600 L/min to provide a numeric editable limit for the supplied `600+` range. Adjust it to verified site-specific values. These are approximate screening guides, not engineering design values. Confirm actual pipe bore, material, pressure, length, local standards, and operating conditions before relying on them. Velocity is stored as guidance and is not calculated from flow readings.

The seeded reference `AQ-DEMO-001` has demonstration tracking key `demo-tracking-key`. New reports always use randomly generated keys.

Community reporters may optionally request current weather context after pinning a location. This uses the free, keyless Open-Meteo forecast API and sends coordinates rounded to one decimal place (approximately 11 km); the returned snapshot is stored with the staff incident record. Weather is informational, not sensor telemetry or proof of a leak. See [Open-Meteo's terms](https://open-meteo.com/en/terms) before using the service beyond a non-commercial demonstration.

## Firebase

1. Create a Firebase project and Firestore database. Enable Email/Password in Firebase Authentication. Create staff accounts using the Firebase console or an authorised administrative provisioning process.
2. Set `STORAGE_DRIVER=firestore`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` on the backend. The latter points to a service-account file outside this repository. On managed infrastructure prefer an attached service identity / Application Default Credentials.
3. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, and `VITE_FIREBASE_PROJECT_ID` before building the frontend. These identify the browser Firebase app and are not Admin credentials. Never prefix secrets with `VITE_`.
4. Deploy `firestore.rules` and `firestore.indexes.json` using Firebase CLI or the console. Browser access to Firestore is denied; the Express API is the access boundary.
5. For production set `DEMO_MODE=false` and `MUNICIPALITY_ID` to your one authorised municipality. Create `users/{firebase-uid}` containing `role` (`admin`, `operator`, `technician`, or `resident`), `municipality` matching `MUNICIPALITY_ID`, and `team` for technicians (for example `Team Alpha`). Tokens alone do not grant municipal access: the server checks this profile on every protected request.
6. Seed verified assets and municipality configuration through an authorised provisioning process; production does not seed the fictional network. Register sensors through the admin UI. Team names and available zone identifiers in this MVP are the demo's fixed set and need adaptation for a pilot municipality.

Role boundaries are enforced by the API, not just by hidden UI controls:

- **Administrator:** full staff access, including sensor registration/configuration, pipeline thresholds, detection settings, audit logs, demo reset, assignment, verification, reporting, and simulation.
- **Operator:** operational read access, incident validation/assignment/verification/closure, maintenance scheduling, simulations in demo mode, and report exports. Cannot change admin settings, sensor or pipeline configuration, reset demo data, or view audit logs.
- **Technician:** read-only operational monitoring plus updates to incidents and maintenance tasks assigned to their team. May move assigned incidents through **In Progress → Resolved** and tasks through **Scheduled → In Progress → Completed**. Cannot work on another team's items, validate/assign/verify/close/reopen incidents, schedule tasks, run simulations, export reports, or change configuration. Realtime incident notifications are limited to that technician's team.
- **Resident:** public incident submission and private-key report tracking only; no staff API, dashboard, or staff realtime access.

Production technician Firebase profiles must include a non-empty `team`. Staff user creation and role provisioning are intentionally console-managed in this MVP; there is no user-management screen.

Firebase mode uses `demo_`-prefixed collections when `DEMO_MODE=true`; production uses unprefixed collections. Use separate Firebase projects for real production and demonstration deployments as an additional boundary. This MVP runs one municipality per backend and is **not** a multi-tenant SaaS implementation.

## Device telemetry

With production mode enabled, register a `LIVE` sensor and set a strong `DEVICE_API_KEY` on the server. Send numeric values to `POST /api/v1/telemetry` with `x-device-key`. The server applies the registered scale and offset, sets its own timestamp, persists the reading, and emits a Socket.IO event. Devices do not publish Socket.IO messages. Demo mode rejects this endpoint; production rejects simulation creation.

The shared device secret is an MVP ingestion boundary. A pilot should replace it with per-device credentials, rotation, revocation, replay protection, and calibrated physical validation. No endpoint controls pumps or valves.

## Vercel frontend / Render backend

- Vercel: import this repository; use `npm run build`, output `dist`, and set the public Firebase variables and `VITE_API_URL=https://your-api.onrender.com`. `vercel.json` supplies SPA rewrites.
- Render: `render.yaml` defines a Node service. Supply `CLIENT_ORIGIN` as the exact Vercel HTTPS origin, the Firebase project and municipality IDs, and a secret file `firebase-admin.json` mounted at `/etc/secrets/firebase-admin.json`. Keep `DEMO_MODE=false` and `STORAGE_DRIVER=firestore`.
- `npm start` starts the compiled Express server. Render supplies `PORT`. Production binds to `0.0.0.0` and uses the platform TLS terminator. Socket.IO reconnects automatically and the UI also polls every 15 seconds.
- Redeploy the frontend after changing `VITE_*` values. Secrets belong in provider settings and are never committed.

No cloud project, credential, hosted deployment, or real municipal data is supplied by this repository. Firebase and cloud deployment must be verified against your configured project before pilot use.

## Operational limits

This is a hackathon MVP. The backend keeps its working set in memory and synchronises changed documents to Firestore. Use one instance; do not horizontally scale this implementation. Replace the store with paginated Firestore repositories and transaction-backed workflow writes before multi-instance deployment. Move high-volume telemetry to a purpose-built time-series store or an analytical warehouse; preserve Firestore for incidents, assignments, configuration, and audit records.

Demo telemetry retains a rolling 24-hour window; incidents and their histories persist until reset. Demo loss estimates integrate positive simulated excess flow and are not validated physical losses. Network flow is a sum of flow sensors, which may double-count serial pipeline segments; it is not billed consumption. Actual consumption accounting requires a verified network topology and calibrated meters.

Evidence images are resized for the bounded MVP document store. Production should use private object storage with signed access URLs and lifecycle retention. Enforce your municipality's approved retention periods, access review, incident response, backup, deletion, and consent procedures before collecting real resident information. The software includes privacy controls; it does not establish legal compliance by itself.
