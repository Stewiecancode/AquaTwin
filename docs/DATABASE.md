# Database schema and storage

Shared TypeScript types and input schemas live in `shared/domain.ts`. Production uses these Firestore collections; demo Firestore adds `demo_` to each name.

| Collection | Records |
|---|---|
| municipalities | ID and display name |
| users | Firebase UID document: role, team, municipality; provisioned through Firebase console |
| roles | Role IDs and descriptive permission labels; actual enforcement lives on API routes |
| infrastructure_assets | Asset ID, name, type, zone, GPS, optional pipeline path / model mesh |
| sensors | Full registry, calibration, thresholds, source, coordinates, last reading, connectivity |
| sensor_readings | Production numeric measurement, sensor ID, source, baseline, server timestamp |
| simulation_readings | Separate demo measurements and optional simulation session association |
| incidents | Reference, tracking hash, category, location, workflow, ownership, private notes/contact, bounded evidence |
| incident_status_history | Immutable timestamped status-action records referencing incident ID |
| maintenance_tasks | Preventive job, assigned team, due date, status |
| maintenance_actions | Timestamped actor/action/resource records |
| simulation_sessions | Pipeline, severity, start/stop, linked suspected-leak incident, session events |
| notifications | Suspected-leak message, incident ID, timestamp |
| audit_logs | Actor, action, resource ID, timestamp |
| settings | `network`: municipality display name and anomaly thresholds |

Documents use random UUIDs except sensors (human-readable registered IDs), fixed settings, role IDs, and Firebase user UIDs. Public references use a random suffix. Private tracking keys use 144 bits of randomness; only hashes are persisted. Sensor coordinates are null until an administrator places them in the model.

The local file adapter has the same collection-shaped data model (except provisioned Firebase users). It serialises writes through an atomic temp-file rename. Firestore synchronisation writes changed documents and deletes expired demo measurements using bounded batches. Reads are currently loaded into memory on startup. Do not edit operational documents externally while the backend is running. One backend instance per municipality/store is a deliberate MVP constraint.

`firestore.indexes.json` provides initial indexes for sensor history and zone/status incident queries when migrating to paginated repository queries. Current reads are in-memory and therefore do not depend on these indexes.

Before production scale: transactional compare-and-set status transitions, paginated Firestore repositories, immutable audit retention, private object storage for evidence, backup/recovery tests, server-side aggregation, device credential registry, and a separate high-volume telemetry store. Current telemetry is numeric; valve states can be represented as percentage (0–100), not arbitrary strings.
