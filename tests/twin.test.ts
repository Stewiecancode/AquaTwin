import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import express from "express";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, MeshStandardMaterial } from "three";
import { createTwinRouter } from "../server/twin.js";
import { twinStateSchema } from "../shared/twin.js";
import { createTownshipMotion } from "../client/components/township-motion.js";
const require = createRequire(import.meta.url);
const { createController } = require("../tools/water-controller/controller.js");

test("authenticated adapter forwards controller lifecycle, rejects invalid commands, reports offline", async () => {
  const controller = createController();
  await new Promise<void>((r) => controller.server.listen(0, "127.0.0.1", r));
  const upstream = `http://127.0.0.1:${controller.server.address().port}`;
  const app = express();
  app.use(express.json());
  app.use("/twin", (req, res, next) =>
    req.headers.authorization
      ? next()
      : res.status(401).json({ error: "Sign in" }),
  );
  app.use(
    "/twin",
    createTwinRouter(
      (req, res, next) =>
        req.headers.authorization === "admin"
          ? next()
          : res.status(403).json({ error: "Read only" }),
      upstream,
    ),
  );
  app.use((err: any, _req: any, res: any, _next: any) =>
    res
      .status(err.status || (err.name === "ZodError" ? 400 : 500))
      .json({ error: err.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/twin`;
  const post = (body: unknown, role = "admin") =>
    fetch(base + "/leak", {
      method: "POST",
      headers: { Authorization: role, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  let closed = false;
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await post({ active: true }, "technician")).status, 403);
    assert.equal((await post({ active: true, lossLps: 9 })).status, 400);
    const initial = await (
      await fetch(base, { headers: { Authorization: "technician" } })
    ).json();
    assert.equal(initial.data.state.leak.active, false);
    let state = (await (await post({ active: true, lossLps: 3.6 })).json())
      .data;
    assert.equal(state.flowMultiplier, 0.55);
    assert.equal(state.householdTotalLps, 4.4);
    state = (await (await post({ active: true, lossLps: 8 })).json()).data;
    assert.equal(state.flowMultiplier, 0);
    state = (await (await post({ active: false, lossLps: 0 })).json()).data;
    assert.equal(state.flowMultiplier, 1);
    const history = await (
      await fetch(base, { headers: { Authorization: "admin" } })
    ).json();
    assert.deepEqual(
      history.data.events.map((e: any) => e.type),
      ["leak_started", "leak_updated", "leak_repaired"],
    );
    await controller.close();
    closed = true;
    assert.equal(
      (await fetch(base, { headers: { Authorization: "admin" } })).status,
      503,
    );
  } finally {
    if (!closed) await controller.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("real exported GLB loads, matches pipe endpoints, animates leak, freezes offline and repairs", async () => {
  const bytes = await readFile(
    new URL("../public/models/municipal-water-network.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const model = gltf.scene,
    motion = createTownshipMotion(model);
  assert.equal(motion.flowCount, 57);
  assert.equal(
    gltf.animations.length,
    0,
    "No baked timer may override controller state",
  );
  let shells = 0;
  model.traverse((o) => {
    if (o.userData.twinRole === "shell" && o instanceof Mesh) {
      shells++;
      const m = o.material as MeshStandardMaterial;
      assert.ok(m.transparent && m.opacity < 1);
    }
  });
  assert.ok(shells >= 14);
  const objects: any[] = [];
  model.traverse((o) => objects.push(o));
  const flow = objects.find(
    (o) => o.userData.twinName === "Service 0 1 flow 00",
  );
  const supply = objects.find(
    (o) => o.userData.twinName === "Supply inlet flow 00",
  );
  const spray = objects.find((o) => o.userData.twinRole === "spray");
  assert.ok(flow && supply && spray);
  const sample = twinStateSchema.parse({
    instanceId: "test",
    revision: 0,
    updatedAt: new Date().toISOString(),
    mode: "simulation",
    supplyLps: 8,
    householdCount: 8,
    leak: {
      id: "L-01",
      active: false,
      lossLps: 0,
      location: { x: -9, y: 0, z: 1.2 },
    },
    householdTotalLps: 8,
    perHouseholdLps: 1,
    flowMultiplier: 1,
    blender: { connected: false, appliedRevision: null, synchronized: false },
  });
  motion.update(0, sample, true);
  assert.ok(
    flow.position.distanceTo(new flow.position.constructor(0, 1.2, 0)) < 0.001,
    "Blender Z-up becomes browser Y-up",
  );
  const p = flow.position.clone();
  motion.update(0.1, sample, true);
  const normalDistance = p.distanceTo(flow.position);
  assert.ok(Math.abs(normalDistance - 0.22) < 0.0001);
  const leak = {
    ...sample,
    leak: { ...sample.leak, active: true, lossLps: 3.6 },
    flowMultiplier: 0.55,
  };
  const before = flow.position.clone();
  motion.update(0.1, leak, true);
  assert.ok(
    Math.abs(before.distanceTo(flow.position) / normalDistance - 0.55) < 0.0001,
  );
  assert.equal(spray.visible, true);
  const stopped = flow.position.clone(),
    upstream = supply.position.clone();
  motion.update(0.1, { ...leak, flowMultiplier: 0 }, true);
  assert.ok(flow.position.equals(stopped));
  assert.ok(!supply.position.equals(upstream));
  const frozen = objects.map((o) => o.position.clone());
  motion.update(0.1, leak, false);
  assert.ok(objects.every((o, i) => o.position.equals(frozen[i])));
  motion.update(0.1, sample, true);
  assert.equal(spray.visible, false);
  assert.ok(!flow.position.equals(stopped));
});
