# Live township viewer

The Digital twin page automatically loads `public/models/municipal-water-network.glb`.
It includes the eight homes, one reservoir, transparent pipe shells, water tracers,
and L-01 leak effects exported from the Blender project. Blender is not required
to use this browser viewer.

## Run

1. Start AquaTwin as usual: `npm run dev`.
2. In a separate terminal, start the controller manually:

   ```powershell
   cd tools/water-controller
   node controller.js
   ```

   Alternatively keep using your original controller file. Run only one controller
   on port 8765. The dashboard does not launch it or install a background service.
3. Sign in as an administrator or operator and open **Digital twin** (`/digital-twin`).
4. Use **Start leak**, **Apply leak rate**, and **Repair leak** above the model.
5. Ctrl+C in the controller terminal pauses browser motion within approximately
   three seconds. Starting Node again resumes it automatically. The last readings
   remain visibly marked stale while disconnected.

The same controller can drive Blender's existing Python bridge at the same time.
Blender connection status is informational; browser motion does not depend on it.

## API and permissions

The browser uses the existing authenticated AquaTwin API, not cross-origin requests
to localhost. No browser CORS configuration is needed for this integration.

- `GET /api/v1/twin`: current controller state plus incident history. Staff only.
- `POST /api/v1/twin/leak`: JSON `{active, lossLps, pipeId: "L-01"}`. Admin/operator only.
- `TWIN_CONTROLLER_URL` on the backend defaults to `http://127.0.0.1:8765`.
- The backend applies a 1.5-second upstream timeout and reports controller failures.
- The browser polls once a second, freezes stale animation and rejects stale polling
  responses after commands. Technician accounts have read-only access.

Flow values balance against a fixed 8 L/s supply. Normal delivery is 1 L/s per home.
A 3.6 L/s leak leaves 4.4 L/s total (0.55 per home); an 8 L/s leak stops downstream
water motion. Upstream motion continues. This is an illustrative simulation, not
calibrated hydraulic analysis or real sensor detection.

Controller events appear in the page's **Controller incident history**. These are
separate from AquaTwin's municipal service tickets and its existing flow/pressure
demo simulator. A simulated repair does not close a municipal service ticket.
Controller history resets on Node restart; existing dashboard records are unchanged.

## Model metadata and rendering

The GLB includes `twinRole`, `twinName`, pipe endpoints, flow phase and downstream
flags in glTF extras. `township-motion.ts` consumes these in browser Y-up coordinates
(Blender x,y,z becomes x,z,-y). The browser uses frame deltas for motion and the
controller's flow multiplier for speed, with no baked 10-second leak timeline.
Materials are standard glTF PBR alpha materials. Text labels are exported as meshes.
Dynamic flow labels are dashboard UI rather than stale baked text in the model.

Preview model accepts self-contained GLB files; **Restore township** returns to the
included model. Uploaded previews need the same extras for live water effects.
Sensor placement coordinates in the dashboard are browser/model coordinates.

For deployment, `TWIN_CONTROLLER_URL` must be reachable from the deployed backend;
localhost refers to that backend host. Keep the controller behind the authenticated
AquaTwin backend. Do not publish its unauthenticated standalone port to the internet.

## Verification

`npm run check`, `npm test` and `npm run build` validate types, existing workflows,
the controller adapter, permissions, real GLB loading, transparent materials,
coordinate conversion, flow reduction, total loss, offline freeze and repair.
