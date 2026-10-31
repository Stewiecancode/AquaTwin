import { randomUUID, createHash } from "node:crypto";
import type { State, Sensor, Incident } from "../shared/domain.js";
export const now = () => new Date().toISOString();
export function seed(): State {
  const at = now();
  const specs: [
    string,
    string,
    Sensor["type"],
    string,
    number,
    number,
    number,
    string,
  ][] = [
    [
      "FLOW-001",
      "Main supply flow meter",
      "Flow",
      "L/min",
      120,
      80,
      160,
      "Zone A",
    ],
    [
      "PRES-002",
      "Distribution pressure",
      "Pressure",
      "bar",
      3.5,
      2.5,
      4.5,
      "Zone A",
    ],
    [
      "LEVEL-003",
      "North reservoir level",
      "Hydrostatic Level",
      "%",
      78,
      25,
      95,
      "Zone C",
    ],
    ["FLOW-004", "Branch B flow meter", "Flow", "L/min", 85, 40, 130, "Zone B"],
    [
      "PUMP-005",
      "Pump station current",
      "Pump Current",
      "A",
      12.4,
      5,
      18,
      "Zone C",
    ],
    ["PRES-006", "Branch B pressure", "Pressure", "bar", 3.8, 2.5, 5, "Zone B"],
  ];
  const sensors: Sensor[] = specs.map(
    ([suffix, name, type, unit, value, min, max, zone], i) => ({
      id: `AQ-MHK-${suffix}`,
      name,
      type,
      unit,
      reading: value,
      normalMin: min,
      normalMax: max,
      warning: max,
      critical: max * 1.2,
      municipality: "demo-mahikeng",
      ward: `Ward ${(i % 3) + 1}`,
      zone: zone as Sensor["zone"],
      location: `Fictional installation ${i + 1}`,
      gps: { lat: -25.86 + i * 0.007, lng: 25.63 + i * 0.008 },
      assetId:
        i === 2
          ? "reservoir-a"
          : i === 4
            ? "pump-a"
            : zone === "Zone B"
              ? "pipeline-b"
              : "pipeline-a",
      installedAt: "2026-09-01",
      lastMaintenance: "2026-10-01",
      calibrationDate: "2026-10-01",
      calibration: { offset: 0, scale: 1 },
      manufacturer: "Demo instruments",
      model: "Virtual sensor",
      source: "SIMULATED",
      modelPosition: null,
      modelComponent: "",
      status: "online",
      updatedAt: at,
    }),
  );
  const incidents: Incident[] = [
    {
      id: randomUUID(),
      reference: "AQ-DEMO-001",
      trackingHash: createHash("sha256")
        .update("demo-tracking-key")
        .digest("hex"),
      description:
        "Water pooling alongside the fictional distribution branch. Field verification required.",
      location: "Demo network · Branch B junction",
      gps: { lat: -25.839, lng: 25.654 },
      category: "Water leak",
      contact: "",
      priority: "Moderate",
      status: "Reported",
      department: "Water Services",
      team: "",
      zone: "Zone B",
      assetId: "pipeline-b",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: at,
      targetAt: "",
      history: [
        {
          status: "Reported",
          at: new Date(Date.now() - 3600000).toISOString(),
          by: "Demo resident",
          note: "Fictional community report",
        },
      ],
      evidence: [],
      notes: "",
      cost: 0,
      materials: "",
      verifiedBy: "",
      source: "SIMULATED",
    },
  ];
  return {
    sensors,
    sensor_readings: [],
    simulation_readings: sensors.flatMap((s, i) =>
      Array.from({ length: 48 }, (_, n) => ({
        id: randomUUID(),
        sensorId: s.id,
        value: Number(
          (s.reading * (1 + Math.sin(n * 0.6 + i) * 0.025)).toFixed(2),
        ),
        baseline: s.reading,
        timestamp: new Date(Date.now() - (48 - n) * 60000).toISOString(),
        source: "SIMULATED" as const,
      })),
    ),
    infrastructure_assets: [
      {
        id: "pipeline-a",
        name: "Main supply pipeline",
        type: "pipeline",
        zone: "Zone A",
        gps: { lat: -25.86, lng: 25.63 },
        path: [
          [-25.86, 25.63],
          [-25.853, 25.638],
          [-25.846, 25.646],
        ],
      },
      {
        id: "pipeline-b",
        name: "Distribution branch B",
        type: "pipeline",
        zone: "Zone B",
        gps: { lat: -25.839, lng: 25.654 },
        path: [
          [-25.853, 25.638],
          [-25.839, 25.654],
          [-25.825, 25.67],
        ],
      },
      {
        id: "pipeline-c",
        name: "Reservoir supply link",
        type: "pipeline",
        zone: "Zone C",
        gps: { lat: -25.832, lng: 25.662 },
        path: [
          [-25.846, 25.646],
          [-25.832, 25.662],
        ],
      },
      {
        id: "reservoir-a",
        name: "North reservoir",
        type: "reservoir",
        zone: "Zone C",
        gps: { lat: -25.846, lng: 25.646 },
      },
      {
        id: "pump-a",
        name: "Pump station A",
        type: "pump",
        zone: "Zone C",
        gps: { lat: -25.832, lng: 25.662 },
      },
    ],
    incidents,
    simulation_sessions: [],
    maintenance_tasks: [],
    maintenance_actions: [],
    notifications: [],
    audit_logs: [],
    incident_status_history: [],
    municipalities: [
      { id: "demo-mahikeng", name: "Mahikeng Demo Municipality" },
    ],
    roles: [
      { id: "admin", permissions: ["*"] },
      { id: "operator", permissions: ["monitor", "incidents", "simulations"] },
      { id: "technician", permissions: ["assigned repairs"] },
      { id: "resident", permissions: ["report", "track"] },
    ],
    settings: [
      {
        id: "network",
        flowIncrease: 25,
        pressureDrop: 20,
        name: "Mahikeng Demo Municipality",
      },
    ],
  };
}
