import { z } from "zod";
export const sensorTypes = [
  "Flow",
  "Pressure",
  "Ultrasonic Level",
  "Hydrostatic Level",
  "Temperature",
  "Conductivity",
  "Turbidity",
  "Pump Current",
  "Pump Vibration",
  "Valve Position",
] as const;
export const statuses = [
  "Reported",
  "Validated",
  "Assigned",
  "In Progress",
  "Resolved",
  "Verified",
  "Closed",
] as const;
export const roles = ["admin", "operator", "technician", "resident"] as const;
export type Role = (typeof roles)[number];
export const pipeDiametersMm = [15, 20, 22, 25, 32, 40, 50, 75, 110] as const;
export const pipeFlowLimitsLpm: Record<
  (typeof pipeDiametersMm)[number],
  number
> = {
  15: 20,
  20: 37,
  22: 60,
  25: 60,
  32: 100,
  40: 150,
  50: 230,
  75: 600,
  110: 600,
};
export const pipeVelocityLimitsMps: Record<
  (typeof pipeDiametersMm)[number],
  number
> = {
  15: 2,
  20: 2,
  22: 2,
  25: 2,
  32: 2,
  40: 2,
  50: 2,
  75: 2.5,
  110: 3,
};
export const pipeDiameterSchema = z.enum(
  pipeDiametersMm.map(String) as [string, ...string[]],
);
export const coordinates = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const sensorSchema = z
  .object({
    id: z.string().regex(/^[A-Z0-9-]{3,60}$/),
    name: z.string().min(3).max(120),
    type: z.enum(sensorTypes),
    municipality: z.string().default("demo-mahikeng"),
    ward: z.string().max(60),
    zone: z.enum(["Zone A", "Zone B", "Zone C"]),
    location: z.string().max(200),
    gps: coordinates,
    assetId: z.string().max(80),
    installedAt: z.string().max(30),
    lastMaintenance: z.string().max(30).default(""),
    calibrationDate: z.string().max(30).default(""),
    calibration: z
      .object({ offset: z.number(), scale: z.number() })
      .default({ offset: 0, scale: 1 }),
    manufacturer: z.string().max(100).default("Demo instruments"),
    model: z.string().max(100).default("Virtual sensor"),
    unit: z.string().min(1).max(20),
    normalMin: z.number(),
    normalMax: z.number(),
    warning: z.number(),
    critical: z.number(),
    source: z.enum(["LIVE", "SIMULATED", "MANUAL"]),
    modelPosition: z
      .object({ x: z.number(), y: z.number(), z: z.number() })
      .nullable()
      .default(null),
    modelComponent: z.string().max(120).default(""),
  })
  .refine((s) => s.normalMin < s.normalMax, {
    message: "Normal minimum must be lower than maximum",
  });
export type SensorInput = z.infer<typeof sensorSchema>;
export type Sensor = SensorInput & {
  status: "online" | "offline" | "warning" | "critical";
  reading: number;
  updatedAt: string;
};
export type Reading = {
  id: string;
  sensorId: string;
  value: number;
  baseline: number;
  timestamp: string;
  source: Sensor["source"];
  sessionId?: string;
};
export type Asset = {
  id: string;
  name: string;
  type: "pipeline" | "reservoir" | "pump";
  zone: string;
  gps: { lat: number; lng: number };
  path?: [number, number][];
  modelComponent?: string;
  nominalDiameterMm?: (typeof pipeDiametersMm)[number] | null;
  maxSafeVelocityMps?: number | null;
  maxSafeFlowLpm?: number | null;
};
export const evidenceSchema = z.object({
  name: z.string().max(120),
  data: z
    .string()
    .max(140000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  stage: z.enum(["report", "before", "after"]),
});
export const weatherContextSchema = z.object({
  source: z.literal("Open-Meteo"),
  observedAt: z.string().min(1).max(40),
  temperatureC: z.number().finite().min(-100).max(70),
  precipitationMm: z.number().finite().min(0).max(1000),
  weatherCode: z.number().int().min(0).max(99),
});
export type WeatherContext = z.infer<typeof weatherContextSchema>;
export const reportSchema = z
  .object({
    description: z.string().min(10).max(2000),
    location: z.string().min(3).max(200),
    gps: coordinates,
    category: z.enum([
      "Water leak",
      "No water",
      "Low pressure",
      "Water quality",
      "Other",
    ]),
    contact: z.string().max(150).default(""),
    consent: z.boolean().default(false),
    evidence: z.array(evidenceSchema).max(3).default([]),
    weatherContext: weatherContextSchema.optional(),
  })
  .refine((v) => !v.contact || v.consent, {
    message: "Consent is required when supplying contact details",
  });
export type History = { status: string; at: string; by: string; note: string };
export type Incident = {
  id: string;
  reference: string;
  trackingHash: string;
  description: string;
  location: string;
  gps: { lat: number; lng: number };
  category: string;
  contact: string;
  priority: "Minor" | "Moderate" | "Critical";
  status: (typeof statuses)[number];
  department: string;
  team: string;
  zone: string;
  assetId: string;
  createdAt: string;
  updatedAt: string;
  targetAt: string;
  history: History[];
  evidence: z.infer<typeof evidenceSchema>[];
  weatherContext?: WeatherContext;
  notes: string;
  cost: number;
  materials: string;
  verifiedBy: string;
  sessionId?: string;
  source: "COMMUNITY" | "SIMULATED";
};
export type Simulation = {
  id: string;
  assetId: string;
  zone: string;
  severity: Incident["priority"];
  startedAt: string;
  stoppedAt: string | null;
  incidentId: string | null;
  events: History[];
};
export type MaintenanceTask = {
  id: string;
  incidentId: string | null;
  title: string;
  team: string;
  zone: string;
  targetAt: string;
  status: "Scheduled" | "In Progress" | "Completed";
  createdAt: string;
};
export type Settings = {
  id: string;
  flowIncrease: number;
  pressureDrop: number;
  name: string;
};
export type Notification = {
  id: string;
  message: string;
  at: string;
  incidentId: string;
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  at: string;
  resourceId: string;
};
export type State = {
  sensors: Sensor[];
  sensor_readings: Reading[];
  simulation_readings: Reading[];
  infrastructure_assets: Asset[];
  incidents: Incident[];
  simulation_sessions: Simulation[];
  maintenance_tasks: MaintenanceTask[];
  maintenance_actions: Audit[];
  notifications: Notification[];
  audit_logs: Audit[];
  incident_status_history: (History & { id: string; incidentId: string })[];
  municipalities: { id: string; name: string }[];
  roles: { id: string; permissions: string[] }[];
  settings: Settings[];
};
export type Summary = {
  totalSensors: number;
  online: number;
  offline: number;
  leaks: number;
  flow: number;
  pressure: number;
  level: number;
  losses: number;
  openTickets: number;
  resolved: number;
  responseHours: number | null;
  performance: number;
  updatedAt: string;
};
export function nextStatus(current: Incident["status"]) {
  return statuses[statuses.indexOf(current) + 1];
}
export function detectAnomaly(
  flow: number,
  pressure: number,
  baselineFlow: number,
  baselinePressure: number,
  rules: Pick<Settings, "flowIncrease" | "pressureDrop">,
) {
  return (
    flow > baselineFlow * (1 + rules.flowIncrease / 100) &&
    pressure < baselinePressure * (1 - rules.pressureDrop / 100)
  );
}
