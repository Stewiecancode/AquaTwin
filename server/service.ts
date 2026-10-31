import { randomUUID, randomBytes, createHash } from "node:crypto";
import { state } from "./store.js";
import { now } from "./seed.js";
import type { Incident, Summary } from "../shared/domain.js";
import { reportSchema } from "../shared/domain.js";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function audit(actor: string, action: string, resourceId: string) {
  const entry = { id: randomUUID(), actor, action, resourceId, at: now() };
  state.audit_logs.push(entry);
  return entry;
}
export function recordHistory(incident: Incident, actor: string, note: string) {
  const entry = { status: incident.status, at: now(), by: actor, note };
  incident.history.push(entry);
  incident.updatedAt = entry.at;
  state.incident_status_history.push({
    ...entry,
    id: randomUUID(),
    incidentId: incident.id,
  });
  audit(actor, `incident:${incident.status}`, incident.id);
}
export function createIncident(
  input: unknown,
  source: Incident["source"] = "COMMUNITY",
) {
  const data = reportSchema.parse(input);
  const trackingKey = randomBytes(18).toString("base64url");
  const id = randomUUID();
  const incident: Incident = {
    ...data,
    id,
    reference: `AQ-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`,
    trackingHash: hash(trackingKey),
    priority: "Moderate",
    status: "Reported",
    department: "Water Services",
    team: "",
    zone: "Unmapped",
    assetId: "",
    createdAt: now(),
    updatedAt: now(),
    targetAt: "",
    history: [],
    notes: "",
    cost: 0,
    materials: "",
    verifiedBy: "",
    source,
  };
  state.incidents.push(incident);
  recordHistory(
    incident,
    source === "COMMUNITY" ? "Resident" : "Simulator",
    "Incident received; awaiting validation",
  );
  return { incident, trackingKey };
}
export function summary(
  sensorIds?: Set<string>,
  incidents = state.incidents,
): Summary {
  const sensors = state.sensors.filter(
    (s) => !sensorIds || sensorIds.has(s.id),
  );
  const online = sensors.filter((s) => s.status !== "offline");
  const values = (type: string) => online.filter((s) => s.type === type);
  const avg = (type: string) => {
    const items = values(type);
    return items.length
      ? items.reduce((a, s) => a + s.reading, 0) / items.length
      : 0;
  };
  const responses = incidents.flatMap((i) => {
    const assigned = i.history.find((h) => h.status === "Assigned");
    return assigned
      ? [(Date.parse(assigned.at) - Date.parse(i.createdAt)) / 3600000]
      : [];
  });
  const readings = state.simulation_readings.filter(
    (r) =>
      (!sensorIds || sensorIds.has(r.sensorId)) &&
      r.sessionId &&
      state.sensors.find((s) => s.id === r.sensorId)?.type === "Flow",
  );
  let losses = 0;
  const last = new Map<string, number>();
  for (const r of readings) {
    const key = r.sessionId + r.sensorId;
    const t = Date.parse(r.timestamp);
    const prior = last.get(key);
    if (prior)
      losses +=
        Math.max(0, r.value - r.baseline) * Math.min((t - prior) / 60000, 1);
    last.set(key, t);
  }
  return {
    totalSensors: sensors.length,
    online: online.length,
    offline: sensors.length - online.length,
    leaks: incidents.filter(
      (i) =>
        i.category === "Water leak" &&
        !["Resolved", "Verified", "Closed"].includes(i.status),
    ).length,
    flow: values("Flow").reduce((a, s) => a + s.reading, 0),
    pressure: avg("Pressure"),
    level: avg("Hydrostatic Level"),
    losses,
    openTickets: incidents.filter(
      (i) => !["Resolved", "Verified", "Closed"].includes(i.status),
    ).length,
    resolved: incidents.filter((i) =>
      ["Resolved", "Verified", "Closed"].includes(i.status),
    ).length,
    responseHours: responses.length
      ? responses.reduce((a, b) => a + b, 0) / responses.length
      : null,
    performance: incidents.length
      ? (incidents.filter((i) => ["Verified", "Closed"].includes(i.status))
          .length /
          incidents.length) *
        100
      : 0,
    updatedAt: now(),
  };
}
