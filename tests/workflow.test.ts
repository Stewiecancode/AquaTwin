import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io, type Socket } from "socket.io-client";
import { detectAnomaly, sensorSchema } from "../shared/domain.js";
const port = 4187;
const base = `http://127.0.0.1:${port}/api/v1`;
let processHandle: ChildProcess;
let directory: string;
let admin = "";
let technician = "";
let socket: Socket;
const request = async (
  path: string,
  method = "GET",
  body?: unknown,
  token = admin,
) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json()) };
};
async function start() {
  processHandle = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        DEMO_MODE: "true",
        STORAGE_DRIVER: "file",
        PORT: String(port),
        DATA_DIR: directory,
      },
      stdio: "pipe",
    },
  );
  let log = "";
  processHandle.stderr?.on("data", (chunk) => (log += chunk));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw Error("Test server did not start: " + log);
}
async function stop() {
  socket?.disconnect();
  if (processHandle?.exitCode === null) {
    processHandle.kill();
    await new Promise<void>((r) => processHandle.once("exit", () => r()));
  }
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "aquatwin-test-"));
  await start();
  admin = (await request("/auth/demo", "POST", { role: "admin" }, "")).data
    .token;
  technician = (await request("/auth/demo", "POST", { role: "technician" }, ""))
    .data.token;
});
after(async () => {
  await stop();
  await rm(directory, { recursive: true, force: true });
});
test("complete municipal workflow, privacy, role restrictions, simulation, and restart persistence", async () => {
  assert.equal((await request("/sensors", "GET", undefined, "")).status, 401);
  const reported = await request(
    "/incidents",
    "POST",
    {
      description: "A community test report for visible pooling water.",
      location: "Test street corner",
      gps: { lat: -25.85, lng: 25.65 },
      category: "Water leak",
      contact: "resident@example.test",
      consent: true,
    },
    "",
  );
  assert.equal(reported.status, 201);
  const { reference, trackingKey } = reported.data;
  assert.equal(
    (
      await request(
        "/public/track",
        "POST",
        { reference, trackingKey: "wrong" },
        "",
      )
    ).status,
    404,
  );
  const tracked = await request(
    "/public/track",
    "POST",
    { reference, trackingKey },
    "",
  );
  assert.equal(tracked.data.status, "Reported");
  assert.equal(tracked.data.contact, undefined);
  assert.equal(tracked.data.gps, undefined);
  assert.equal(tracked.data.history[0].by, undefined);
  const list = (await request("/incidents")).data;
  const incident = list.find((i: any) => i.reference === reference);
  assert.equal(incident.contact, undefined);
  assert.equal(incident.trackingHash, undefined);
  assert.equal(
    (
      await request(`/incidents/${incident.id}`, "PATCH", {
        status: "Resolved",
        notes: "Cannot skip stages",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/incidents/${incident.id}`,
        "PATCH",
        { status: "Validated" },
        technician,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/incidents/${incident.id}`, "PATCH", {
        status: "Validated",
        zone: "Zone A",
        assetId: "pipeline-a",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/incidents/${incident.id}/assign`, "POST", {
        team: "Team Alpha",
        targetAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/incidents/${incident.id}`,
        "PATCH",
        { status: "In Progress" },
        technician,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/incidents/${incident.id}`,
        "PATCH",
        { status: "Resolved" },
        technician,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/incidents/${incident.id}`,
        "PATCH",
        {
          status: "Resolved",
          notes: "Replaced failed coupling and checked pressure.",
          cost: 250,
          materials: "One coupling",
        },
        technician,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/incidents/${incident.id}/verify`,
        "POST",
        { notes: "Independent visual inspection complete." },
        technician,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/incidents/${incident.id}/verify`, "POST", {
        notes: "Independent visual inspection complete.",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/incidents/${incident.id}`, "PATCH", { status: "Closed" }))
      .status,
    200,
  );
  const publicClosed = (
    await request("/public/track", "POST", { reference, trackingKey }, "")
  ).data;
  assert.equal(publicClosed.status, "Closed");
  assert.deepEqual(
    publicClosed.history.map((h: any) => h.status),
    [
      "Reported",
      "Validated",
      "Assigned",
      "In Progress",
      "Resolved",
      "Verified",
      "Closed",
    ],
  );
  assert.ok(publicClosed.history.every((h: any) => !("note" in h)));
  assert.equal(
    (
      await request(
        "/simulations/start",
        "POST",
        { assetId: "pipeline-a", severity: "Critical" },
        technician,
      )
    ).status,
    403,
  );
  socket = io(`http://127.0.0.1:${port}`, { auth: { token: admin } });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  const anomaly = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("No real-time anomaly event")),
      12000,
    );
    socket.once("leak:suspected", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  const simulation = await request("/simulations/start", "POST", {
    assetId: "pipeline-a",
    severity: "Critical",
  });
  assert.equal(simulation.status, 201);
  await anomaly;
  const sessions = (await request("/simulations")).data;
  assert.ok(sessions.find((s: any) => s.id === simulation.data.id).incidentId);
  assert.equal(
    (await request(`/simulations/${simulation.data.id}/stop`, "POST")).status,
    200,
  );
  const beforeRestart = (await request("/incidents")).data.length;
  await stop();
  await start();
  admin = (await request("/auth/demo", "POST", { role: "admin" }, "")).data
    .token;
  assert.equal((await request("/incidents")).data.length, beforeRestart);
  assert.equal(
    (await request("/public/track", "POST", { reference, trackingKey }, ""))
      .data.status,
    "Closed",
  );
});
test("anomaly rules require both signals and sensor ranges validate", () => {
  assert.equal(
    detectAnomaly(175, 2.1, 120, 3.5, { flowIncrease: 25, pressureDrop: 20 }),
    true,
  );
  assert.equal(
    detectAnomaly(175, 3.5, 120, 3.5, { flowIncrease: 25, pressureDrop: 20 }),
    false,
  );
  assert.equal(
    detectAnomaly(120, 2.1, 120, 3.5, { flowIncrease: 25, pressureDrop: 20 }),
    false,
  );
  assert.equal(sensorSchema.safeParse({ id: "bad" }).success, false);
});
