import "dotenv/config";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createServer } from "node:http";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { Server } from "socket.io";
import { z, ZodError } from "zod";
import {
  state,
  initStore,
  persist,
  demo,
  firestore,
  firebaseApp,
  resetState,
} from "./store.js";
import { now } from "./seed.js";
import {
  audit,
  createIncident,
  recordHistory,
  hash,
  summary,
} from "./service.js";
import {
  sensorSchema,
  statuses,
  evidenceSchema,
  detectAnomaly,
  type Role,
  type Incident,
} from "../shared/domain.js";

type User = { uid: string; role: Role; team: string; municipality: string };
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
const app = express();
const http = createServer(app);
const origin = process.env.CLIENT_ORIGIN || "http://127.0.0.1:5173";
const io = new Server(http, { cors: { origin } });
const sessions = new Map<string, { user: User; expires: number }>();
app.use(helmet());
app.use(cors({ origin }));
app.use(express.json({ limit: "5mb" }));
app.use("/api", rateLimit({ windowMs: 60000, limit: 300 }));
const api = express.Router();
app.use("/api/v1", api);
function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
async function authenticate(token: string): Promise<User> {
  if (demo) {
    const s = sessions.get(token);
    if (!s || s.expires < Date.now())
      fail("Demo session expired. Sign in again.", 401);
    return s.user;
  }
  const decoded = await getAuth(firebaseApp()).verifyIdToken(token, true);
  const doc = await getFirestore().collection("users").doc(decoded.uid).get();
  const profile = doc.data();
  if (
    !profile ||
    !["admin", "operator", "technician", "resident"].includes(profile.role) ||
    profile.municipality !== process.env.MUNICIPALITY_ID
  )
    fail("Municipal access denied", 403);
  return {
    uid: decoded.uid,
    role: profile.role,
    team: profile.team || "",
    municipality: profile.municipality,
  };
}
const protect = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    req.user = await authenticate(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    );
    next();
  } catch {
    next(Object.assign(new Error("Authentication required"), { status: 401 }));
  }
};
const allow =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(
        Object.assign(new Error("Your role cannot perform this action"), {
          status: 403,
        }),
      );
    next();
  };
const out = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ data });
const emit = (event: string, data: unknown) =>
  io.to("municipal").emit(event, data);
io.use(async (socket, next) => {
  try {
    const user = await authenticate(socket.handshake.auth.token || "");
    if (user.role === "resident") throw Error();
    socket.data.user = user;
    socket.data.expires = Date.now() + 3600000;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});
io.on("connection", (s) => {
  s.join("municipal");
  const timeout = setTimeout(() => s.disconnect(true), 3600000);
  s.on("disconnect", () => clearTimeout(timeout));
});
api.get("/health", (_req, res) =>
  out(res, {
    ok: true,
    demo,
    storage: firestore ? "firestore" : "local file",
    municipality: state.settings[0].name,
  }),
);
api.post(
  "/auth/demo",
  rateLimit({ windowMs: 60000, limit: 20 }),
  (req, res) => {
    if (!demo) fail("Demo login is disabled", 404);
    const role = z
      .enum(["admin", "operator", "technician"])
      .parse(req.body.role || "admin");
    const token = randomBytes(32).toString("base64url");
    const user: User = {
      uid: `demo-${role}`,
      role,
      team: role === "technician" ? "Team Alpha" : "",
      municipality: "demo-mahikeng",
    };
    sessions.set(token, { user, expires: Date.now() + 8 * 3600000 });
    out(res, { token, user });
  },
);
api.post("/auth/logout", protect, (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
  sessions.delete(token);
  for (const s of io.sockets.sockets.values())
    if (s.handshake.auth.token === token) s.disconnect(true);
  out(res, { ok: true });
});
api.post(
  "/incidents",
  rateLimit({ windowMs: 3600000, limit: 30 }),
  async (req, res) => {
    const { incident, trackingKey } = createIncident(req.body);
    await persist();
    emit("incident:created", { id: incident.id });
    out(res, { reference: incident.reference, trackingKey }, 201);
  },
);
api.post(
  "/public/track",
  rateLimit({ windowMs: 60000, limit: 20 }),
  (req, res) => {
    const { reference, trackingKey } = z
      .object({
        reference: z.string().max(60),
        trackingKey: z.string().max(100),
      })
      .parse(req.body);
    const i = state.incidents.find(
      (x) => x.reference === reference && x.trackingHash === hash(trackingKey),
    );
    if (!i) fail("No matching incident and tracking key", 404);
    out(res, {
      reference: i.reference,
      status: i.status,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      history: i.history.map((h) => ({ status: h.status, at: h.at })),
    });
  },
);
api.post("/telemetry", async (req, res) => {
  const secret = process.env.DEVICE_API_KEY;
  const incoming = req.headers["x-device-key"];
  if (
    demo ||
    !secret ||
    typeof incoming !== "string" ||
    incoming.length !== secret.length ||
    !timingSafeEqual(Buffer.from(incoming), Buffer.from(secret))
  )
    fail("Device authentication failed", 401);
  const payload = z
    .object({ sensorId: z.string(), value: z.number().finite() })
    .parse(req.body);
  const sensor = state.sensors.find(
    (s) => s.id === payload.sensorId && s.source === "LIVE",
  );
  if (!sensor) fail("Unknown LIVE sensor", 404);
  sensor.reading =
    payload.value * sensor.calibration.scale + sensor.calibration.offset;
  sensor.updatedAt = now();
  sensor.status =
    sensor.reading < sensor.normalMin || sensor.reading > sensor.normalMax
      ? "warning"
      : "online";
  const reading = {
    id: randomUUID(),
    sensorId: sensor.id,
    value: sensor.reading,
    baseline: (sensor.normalMin + sensor.normalMax) / 2,
    timestamp: now(),
    source: "LIVE" as const,
  };
  state.sensor_readings.push(reading);
  await persist();
  emit("sensor:reading", reading);
  out(res, { accepted: true }, 201);
});
api.use(protect, allow("admin", "operator", "technician"));
api.get("/auth/me", (req, res) => out(res, req.user));
function filtered(req: Request) {
  const q = req.query;
  const sensors = state.sensors.filter(
    (s) =>
      (!q.municipality || q.municipality === s.municipality) &&
      (!q.zone || s.zone === q.zone) &&
      (!q.ward || s.ward === q.ward) &&
      (!q.sensor || s.id === q.sensor) &&
      (!q.asset || s.assetId === q.asset) &&
      (!q.type || s.type === q.type),
  );
  const ids = new Set(sensors.map((s) => s.id));
  const incidents = state.incidents.filter(
    (i) =>
      (!q.zone || i.zone === q.zone) &&
      (!q.asset || i.assetId === q.asset) &&
      (!q.status || i.status === q.status) &&
      (!q.from || i.createdAt >= String(q.from)) &&
      (!q.to || i.createdAt <= String(q.to)) &&
      (!q.ward || sensors.some((s) => s.assetId === i.assetId)) &&
      (!q.sensor || sensors.some((s) => s.assetId === i.assetId)),
  );
  const readings = [...state.sensor_readings, ...state.simulation_readings]
    .filter(
      (r) =>
        ids.has(r.sensorId) &&
        (!q.from || r.timestamp >= String(q.from)) &&
        (!q.to || r.timestamp <= String(q.to)),
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { sensors, ids, incidents, readings };
}
api.get("/dashboard/summary", (req, res) => {
  const f = filtered(req);
  out(res, summary(f.ids, f.incidents));
});
api.get("/sensors", (req, res) => out(res, filtered(req).sensors));
api.post("/sensors", allow("admin"), async (req, res) => {
  const input = sensorSchema.parse(req.body);
  if (state.sensors.some((s) => s.id === input.id))
    fail("Sensor ID already exists", 409);
  if (demo && input.source === "LIVE")
    fail("LIVE sensors cannot be registered in the isolated demo");
  if (!demo && input.source === "SIMULATED")
    fail("Simulated sensors belong in demo mode");
  const sensor = {
    ...input,
    municipality: req.user!.municipality,
    status: "offline" as const,
    reading: 0,
    updatedAt: now(),
  };
  state.sensors.push(sensor);
  audit(req.user!.uid, "sensor:registered", sensor.id);
  await persist();
  emit("sensor:status", sensor);
  out(res, sensor, 201);
});
api.patch("/sensors/:id", allow("admin"), async (req, res) => {
  const index = state.sensors.findIndex((s) => s.id === req.params.id);
  if (index < 0) fail("Sensor not found", 404);
  const input = sensorSchema.parse({
    ...state.sensors[index],
    ...req.body,
    id: req.params.id,
  });
  if (input.source !== state.sensors[index].source)
    fail("Data source cannot be changed; register a separate sensor");
  state.sensors[index] = {
    ...state.sensors[index],
    ...input,
    municipality: req.user!.municipality,
  };
  audit(req.user!.uid, "sensor:updated", input.id);
  await persist();
  emit("sensor:status", state.sensors[index]);
  out(res, state.sensors[index]);
});
api.get("/sensors/:id", (req, res) => {
  const s = state.sensors.find((s) => s.id === req.params.id);
  if (!s) fail("Sensor not found", 404);
  out(res, {
    ...s,
    maintenance: state.maintenance_actions.filter((a) => a.resourceId === s.id),
  });
});
api.get("/sensors/:id/readings", (req, res) =>
  out(
    res,
    filtered(req).readings.filter((r) => r.sensorId === req.params.id),
  ),
);
api.get("/infrastructure", (_req, res) =>
  out(res, state.infrastructure_assets),
);
api.get("/incidents", (req, res) =>
  out(
    res,
    filtered(req)
      .incidents.filter(
        (i) => req.user!.role !== "technician" || i.team === req.user!.team,
      )
      .map(({ trackingHash, contact, ...i }) => i),
  ),
);
function incident(req: Request) {
  const i = state.incidents.find((x) => x.id === req.params.id);
  if (!i) fail("Incident not found", 404);
  if (req.user!.role === "technician" && i.team !== req.user!.team)
    fail("Only your assigned incidents are accessible", 403);
  return i;
}
api.patch("/incidents/:id", async (req, res) => {
  const i = incident(req);
  const data = z
    .object({
      status: z.enum(statuses).optional(),
      priority: z.enum(["Minor", "Moderate", "Critical"]).optional(),
      notes: z.string().max(4000).optional(),
      cost: z.number().nonnegative().max(100000000).optional(),
      materials: z.string().max(2000).optional(),
      targetAt: z.string().datetime().optional(),
      zone: z.enum(["Zone A", "Zone B", "Zone C", "Unmapped"]).optional(),
      assetId: z.string().max(80).optional(),
      evidence: z.array(evidenceSchema).max(6).optional(),
      reopen: z.boolean().optional(),
    })
    .parse(req.body);
  if (
    req.user!.role === "technician" &&
    (data.priority || data.targetAt || data.reopen || data.zone || data.assetId)
  )
    fail("Supervisor permission required", 403);
  if (data.status) {
    if (
      req.user!.role === "technician" &&
      !["In Progress", "Resolved"].includes(data.status)
    )
      fail("Technicians may progress or resolve assigned work", 403);
    if (data.status === "Verified" || data.status === "Assigned")
      fail("Use the verification or assignment action");
    if (data.reopen) {
      if (
        !["Resolved", "Verified", "Closed"].includes(i.status) ||
        data.status !== "Validated" ||
        !data.notes
      )
        fail("Reopening requires a resolved case and a reason");
    } else if (statuses.indexOf(data.status) !== statuses.indexOf(i.status) + 1)
      fail("Follow the incident workflow in order");
    if (data.status === "Resolved" && !(data.notes || i.notes).trim())
      fail("Resolution notes are required");
  }
  const { reopen, ...updates } = data;
  Object.assign(i, updates);
  recordHistory(i, req.user!.uid, data.notes || "Incident updated");
  state.maintenance_actions.push(
    audit(req.user!.uid, "maintenance:updated", i.id),
  );
  await persist();
  emit("incident:updated", { id: i.id });
  out(res, { id: i.id, status: i.status });
});
api.post(
  "/incidents/:id/assign",
  allow("admin", "operator"),
  async (req, res) => {
    const i = incident(req);
    if (!["Validated", "Assigned"].includes(i.status))
      fail("Validate the incident before assigning it");
    const { team, targetAt } = z
      .object({
        team: z.enum(["Team Alpha", "Team Bravo", "Reservoir Unit"]),
        targetAt: z.string().datetime(),
      })
      .parse(req.body);
    i.team = team;
    i.targetAt = targetAt;
    i.status = "Assigned";
    recordHistory(i, req.user!.uid, `Assigned to ${team}`);
    await persist();
    emit("incident:assigned", { id: i.id });
    out(res, { id: i.id });
  },
);
api.post(
  "/incidents/:id/verify",
  allow("admin", "operator"),
  async (req, res) => {
    const i = incident(req);
    if (i.status !== "Resolved")
      fail("Only resolved incidents may be verified");
    const { notes } = z
      .object({ notes: z.string().min(5).max(2000) })
      .parse(req.body);
    i.status = "Verified";
    i.verifiedBy = req.user!.uid;
    recordHistory(i, req.user!.uid, notes);
    await persist();
    emit("incident:updated", { id: i.id });
    out(res, { id: i.id });
  },
);
api.get("/maintenance/tasks", (req, res) =>
  out(
    res,
    state.maintenance_tasks.filter(
      (t) => req.user!.role !== "technician" || t.team === req.user!.team,
    ),
  ),
);
api.post("/maintenance/tasks", allow("admin", "operator"), async (req, res) => {
  const data = z
    .object({
      title: z.string().min(3).max(200),
      team: z.enum(["Team Alpha", "Team Bravo", "Reservoir Unit"]),
      zone: z.enum(["Zone A", "Zone B", "Zone C"]),
      targetAt: z.string().datetime(),
    })
    .parse(req.body);
  const task = {
    ...data,
    id: randomUUID(),
    incidentId: null,
    status: "Scheduled" as const,
    createdAt: now(),
  };
  state.maintenance_tasks.push(task);
  audit(req.user!.uid, "maintenance:scheduled", task.id);
  await persist();
  out(res, task, 201);
});
api.patch("/maintenance/tasks/:id", async (req, res) => {
  const task = state.maintenance_tasks.find((t) => t.id === req.params.id);
  if (!task) fail("Task not found", 404);
  if (req.user!.role === "technician" && task.team !== req.user!.team)
    fail("Assigned team only", 403);
  task.status = z.enum(["In Progress", "Completed"]).parse(req.body.status);
  state.maintenance_actions.push(
    audit(req.user!.uid, `maintenance:${task.status}`, task.id),
  );
  await persist();
  out(res, task);
});
api.get("/simulations", (_req, res) => out(res, state.simulation_sessions));
api.post("/simulations/start", allow("admin", "operator"), async (req, res) => {
  if (!demo) fail("Simulation is isolated to demo mode", 403);
  const data = z
    .object({
      assetId: z.string(),
      severity: z.enum(["Minor", "Moderate", "Critical"]),
    })
    .parse(req.body);
  const asset = state.infrastructure_assets.find(
    (a) => a.id === data.assetId && a.type === "pipeline",
  );
  if (!asset) fail("Demonstration pipeline not found");
  if (
    !state.sensors.some((s) => s.assetId === asset.id && s.type === "Flow") ||
    !state.sensors.some((s) => s.assetId === asset.id && s.type === "Pressure")
  )
    fail("This pipeline needs flow and pressure sensors");
  if (
    state.simulation_sessions.some(
      (s) => !s.stoppedAt && s.assetId === asset.id,
    )
  )
    fail("This pipeline already has an active simulation", 409);
  const session = {
    id: randomUUID(),
    ...data,
    zone: asset.zone,
    startedAt: now(),
    stoppedAt: null,
    incidentId: null,
    events: [
      {
        status: "Started",
        at: now(),
        by: req.user!.uid,
        note: `${data.severity} synthetic anomaly`,
      },
    ],
  };
  state.simulation_sessions.push(session);
  audit(req.user!.uid, "simulation:started", session.id);
  await persist();
  emit("simulation:started", session);
  out(res, session, 201);
});
api.post(
  "/simulations/:id/stop",
  allow("admin", "operator"),
  async (req, res) => {
    const s = state.simulation_sessions.find((s) => s.id === req.params.id);
    if (!s) fail("Simulation not found", 404);
    if (!s.stoppedAt) {
      s.stoppedAt = now();
      s.events.push({
        status: "Stopped",
        at: now(),
        by: req.user!.uid,
        note: "Baseline stream restored; incident remains for verification",
      });
      audit(req.user!.uid, "simulation:stopped", s.id);
      await persist();
      emit("simulation:stopped", s);
    }
    out(res, s);
  },
);
api.get("/notifications", (_req, res) =>
  out(res, state.notifications.slice(-50).reverse()),
);
api.get("/settings", (_req, res) =>
  out(res, {
    ...state.settings[0],
    demo,
    storage: firestore ? "Cloud Firestore" : "Local persistent demo store",
  }),
);
api.patch("/settings", allow("admin"), async (req, res) => {
  const data = z
    .object({
      flowIncrease: z.number().min(1).max(100),
      pressureDrop: z.number().min(1).max(90),
    })
    .parse(req.body);
  Object.assign(state.settings[0], data);
  audit(req.user!.uid, "rules:updated", "network");
  await persist();
  out(res, state.settings[0]);
});
api.post("/demo/reset", allow("admin"), async (req, res) => {
  if (!demo) fail("Demo reset unavailable", 403);
  resetState();
  audit(req.user!.uid, "demo:reset", "demo");
  await persist();
  emit("incident:updated", {});
  out(res, { reset: true });
});
api.get("/analytics/overview", (req, res) => {
  const f = filtered(req);
  const zoneCounts = ["Zone A", "Zone B", "Zone C", "Unmapped"].map((zone) => ({
    zone,
    incidents: f.incidents.filter((i) => i.zone === zone).length,
    closed: f.incidents.filter(
      (i) => i.zone === zone && ["Verified", "Closed"].includes(i.status),
    ).length,
  }));
  const insights = zoneCounts
    .filter((z) => z.incidents >= 2)
    .map(
      (z) => `${z.zone}: ${z.incidents} reports; inspect for recurring faults.`,
    );
  const late = f.incidents.filter(
    (i) =>
      i.targetAt &&
      Date.parse(i.targetAt) < Date.now() &&
      !["Resolved", "Verified", "Closed"].includes(i.status),
  );
  if (late.length)
    insights.push(`${late.length} incident(s) exceed their response target.`);
  f.sensors
    .filter((s) => s.status === "offline")
    .forEach((s) => insights.push(`${s.name} is offline; check connectivity.`));
  out(res, {
    summary: summary(f.ids, f.incidents),
    readings: f.readings,
    zones: zoneCounts,
    insights,
    monthly: Object.entries(
      Object.groupBy(f.incidents, (i) => i.createdAt.slice(0, 7)),
    ).map(([month, items]) => ({ month, incidents: items!.length })),
    quarterly: Object.entries(
      Object.groupBy(
        f.incidents,
        (i) =>
          `${i.createdAt.slice(0, 4)} Q${Math.ceil(Number(i.createdAt.slice(5, 7)) / 3)}`,
      ),
    ).map(([quarter, items]) => ({ quarter, incidents: items!.length })),
  });
});
api.get("/reports/export", allow("admin", "operator"), (req, res) => {
  const f = filtered(req);
  const escape = (v: unknown) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const rows =
    req.query.kind === "readings"
      ? [
          ["sensor", "timestamp", "value", "source"],
          ...f.readings.map((r) => [
            r.sensorId,
            r.timestamp,
            r.value,
            r.source,
          ]),
        ]
      : [
          [
            "reference",
            "status",
            "zone",
            "priority",
            "team",
            "created",
            "source",
          ],
          ...f.incidents.map((i) => [
            i.reference,
            i.status,
            i.zone,
            i.priority,
            i.team,
            i.createdAt,
            i.source,
          ]),
        ];
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="aquatwin-export.csv"',
  );
  res
    .type("text/csv")
    .send(rows.map((r) => r.map(escape).join(",")).join("\r\n"));
});
api.get("/audit", allow("admin"), (_req, res) =>
  out(res, state.audit_logs.slice(-100).reverse()),
);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ error: err.issues.map((i) => i.message).join("; ") });
    return;
  }
  const e = err as Error & { status?: number };
  if (!e.status) console.error(e);
  res
    .status(e.status || 500)
    .json({
      error: e.status ? e.message : "Server could not complete the request",
    });
});
await initStore();
let ticking = false;
setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    for (const sensor of state.sensors) {
      if (sensor.source !== "SIMULATED" || !demo) {
        if (
          Date.now() - Date.parse(sensor.updatedAt) > 60000 &&
          sensor.status !== "offline"
        ) {
          sensor.status = "offline";
          emit("sensor:status", { id: sensor.id });
        }
        continue;
      }
      const previous = state.simulation_readings.find(
        (r) => r.sensorId === sensor.id && !r.sessionId,
      );
      const baseline =
        previous?.baseline ?? (sensor.normalMin + sensor.normalMax) / 2;
      const session = state.simulation_sessions.find(
        (s) => !s.stoppedAt && s.assetId === sensor.assetId,
      );
      const factor = session
        ? { Minor: 0.3, Moderate: 0.46, Critical: 0.75 }[session.severity]
        : 0;
      const variation = Math.sin(Date.now() / 7000 + sensor.id.length) * 0.012;
      const value =
        baseline *
        (1 +
          variation +
          (sensor.type === "Flow"
            ? factor
            : sensor.type === "Pressure"
              ? -factor * 0.85
              : 0));
      sensor.reading = Number(value.toFixed(2));
      sensor.updatedAt = now();
      const before = sensor.status;
      sensor.status =
        value < sensor.normalMin || value > sensor.normalMax
          ? "warning"
          : "online";
      if (session?.severity === "Critical") sensor.status = "critical";
      const reading = {
        id: randomUUID(),
        sensorId: sensor.id,
        value: sensor.reading,
        baseline,
        timestamp: now(),
        source: "SIMULATED" as const,
        ...(session ? { sessionId: session.id } : {}),
      };
      state.simulation_readings.push(reading);
      emit("sensor:reading", reading);
      if (before !== sensor.status) emit("sensor:status", { id: sensor.id });
    }
    for (const session of state.simulation_sessions.filter(
      (s) => !s.stoppedAt && !s.incidentId,
    )) {
      const sensors = state.sensors.filter(
        (s) => s.assetId === session.assetId,
      );
      const flow = sensors.find((s) => s.type === "Flow");
      const pressure = sensors.find((s) => s.type === "Pressure");
      const fb = state.simulation_readings.find(
        (r) => r.sensorId === flow?.id,
      )?.baseline;
      const pb = state.simulation_readings.find(
        (r) => r.sensorId === pressure?.id,
      )?.baseline;
      if (
        flow &&
        pressure &&
        fb &&
        pb &&
        detectAnomaly(flow.reading, pressure.reading, fb, pb, state.settings[0])
      ) {
        const { incident } = createIncident(
          {
            description:
              "Suspected Leak — Requires Verification. Simulated flow increase and pressure decrease exceeded configured thresholds.",
            location: flow.location,
            gps: flow.gps,
            category: "Water leak",
          },
          "SIMULATED",
        );
        Object.assign(incident, {
          sessionId: session.id,
          assetId: session.assetId,
          zone: session.zone,
          priority: session.severity,
        });
        session.incidentId = incident.id;
        session.events.push({
          status: "Anomaly",
          at: now(),
          by: "Simulator",
          note: incident.reference,
        });
        state.notifications.push({
          id: randomUUID(),
          message: `${session.zone}: Suspected Leak — Requires Verification`,
          at: now(),
          incidentId: incident.id,
        });
        emit("leak:suspected", { id: incident.id });
        emit("incident:created", { id: incident.id });
      }
    }
    // Demo readings are deliberately bounded to a rolling 24-hour window; incident history is retained.
    state.simulation_readings = state.simulation_readings.filter(
      (r) => Date.parse(r.timestamp) > Date.now() - 86400000,
    );
    await persist();
  } catch (e) {
    console.error("Telemetry persistence failed", e);
    emit("system:error", { message: "Telemetry persistence failed" });
  } finally {
    ticking = false;
  }
}, 5000);
const port = Number(process.env.PORT || 4000);
http.listen(port, demo ? "127.0.0.1" : "0.0.0.0", () =>
  console.log(
    `AquaTwin API http://127.0.0.1:${port} · ${demo ? "DEMO" : "PRODUCTION"} · ${firestore ? "Firestore" : "persistent file store"}`,
  ),
);
