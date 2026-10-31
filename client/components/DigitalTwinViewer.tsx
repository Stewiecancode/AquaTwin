import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Html, Bounds } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, MeshStandardMaterial, type Material } from "three";
import type { Sensor, Incident } from "../../shared/domain";
import type { TwinState } from "../../shared/twin";
import { RotateCcw, Upload } from "lucide-react";
import { Button, Badge } from "./ui";
import { useTownship } from "../hooks/useTownship";
import { createTownshipMotion } from "./township-motion";

const MODEL = "/models/municipal-water-network.glb";
class ModelBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <Html center>
        <div className="viewer-message" role="alert">
          Unable to load the model. Use a self-contained GLB, or restore the
          township model.
        </div>
      </Html>
    ) : (
      this.props.children
    );
  }
}

function Model({
  url,
  incidentMode,
  sensors,
  incidents,
  state,
  running,
  receivedAt,
}: {
  url: string;
  incidentMode: boolean;
  sensors: Sensor[];
  incidents: Incident[];
  state: TwinState | null;
  running: boolean;
  receivedAt: number;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const { scene, materials, originals } = useMemo(() => {
    const scene = gltf.scene.clone(true),
      materials: Material[] = [],
      originals = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const clone = (m: Material) => {
        const own = m.clone();
        materials.push(own);
        if (
          own instanceof MeshStandardMaterial &&
          m instanceof MeshStandardMaterial
        )
          originals.set(own, m);
        if (own.transparent) own.depthWrite = false;
        return own;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(clone)
        : clone(o.material);
    });
    return { scene, materials, originals };
  }, [gltf]);
  const motion = useMemo(() => createTownshipMotion(scene), [scene]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const affected =
        incidentMode &&
        sensors.some(
          (s) =>
            (s.modelComponent === o.name ||
              s.modelComponent === o.userData.twinName) &&
            incidents.some(
              (i) =>
                i.assetId === s.assetId &&
                !["Resolved", "Verified", "Closed"].includes(i.status),
            ),
        );
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof MeshStandardMaterial)) continue;
        const original = originals.get(m);
        if (!original) continue;
        m.color.copy(original.color);
        m.emissive.copy(original.emissive);
        m.emissiveIntensity = original.emissiveIntensity;
        if (affected) {
          m.color.set("#f26373");
          m.emissive.set("#8b1e31");
          m.emissiveIntensity = 0.4;
        }
      }
    });
  }, [scene, originals, incidentMode, sensors, incidents]);
  useFrame((_, delta) =>
    motion.update(
      delta,
      state,
      running && performance.now() - receivedAt < 3000,
    ),
  );
  return <primitive object={scene} dispose={null} />;
}

export default function DigitalTwinViewer({
  sensors,
  incidents,
  onSensor,
  canControl = false,
}: {
  sensors: Sensor[];
  incidents: Incident[];
  onSensor: (s: Sensor) => void;
  canControl?: boolean;
}) {
  const [url, setUrl] = useState(MODEL),
    [mode, setMode] = useState(false),
    [version, setVersion] = useState(0);
  const [rate, setRate] = useState("3.6"),
    [fileError, setFileError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const twin = useTownship(),
    state = twin.snapshot?.state || null;
  const bundled = url === MODEL;
  useEffect(
    () => () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    },
    [url],
  );
  const validRate =
    Number.isFinite(Number(rate)) && Number(rate) > 0 && Number(rate) <= 8;
  const disabled = !canControl || !twin.online || twin.busy;
  return (
    <div className="twin">
      <section className="township-panel" aria-label="Township controller">
        <div className="section-heading">
          <div>
            <h2>Township water network</h2>
            <p>One reservoir · Eight households · Leak location L-01</p>
          </div>
          <Badge tone={twin.online ? "cyan" : "amber"}>
            {twin.online ? "CONTROLLER ONLINE" : "CONTROLLER OFFLINE"}
          </Badge>
        </div>
        <div
          className={`township-alert ${state?.leak.active ? "is-leaking" : ""}`}
          role="status"
          aria-live="polite"
        >
          {!twin.online
            ? "Animation paused. Start node controller.js to connect."
            : state?.leak.active
              ? `Simulated leak at L-01 — ${state.leak.lossLps.toFixed(2)} L/s lost. Household flow reduced by ${((1 - state.flowMultiplier) * 100).toFixed(0)}%.`
              : "Normal operation — water is flowing to all eight homes."}
          {!twin.online && state && (
            <small>
              Last received readings are shown below; they may be stale.
            </small>
          )}
        </div>
        <div className="township-metrics">
          {[
            ["Supply", state?.supplyLps],
            ["Leak loss", state?.leak.lossLps],
            ["Households total", state?.householdTotalLps],
            ["Per household", state?.perHouseholdLps],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                {typeof value === "number" ? value.toFixed(2) : "—"}{" "}
                <small>L/s</small>
              </strong>
            </div>
          ))}
        </div>
        <div className="township-controls">
          <label htmlFor="township-loss">
            Leak loss (L/s)
            <input
              id="township-loss"
              type="number"
              min="0.01"
              max="8"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={!canControl || twin.busy}
            />
          </label>
          <Button
            disabled={disabled || !!state?.leak.active}
            onClick={() => void twin.command(true, 3.6)}
          >
            Start leak
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !validRate}
            onClick={() => void twin.command(true, Number(rate))}
          >
            Apply leak rate
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !state?.leak.active}
            onClick={() => void twin.command(false, 0)}
          >
            Repair leak
          </Button>
          {twin.busy && <span role="status">Sending command…</span>}
        </div>
        {!canControl && (
          <p className="muted">
            Read-only access. Administrators and operators can change this
            simulation.
          </p>
        )}
        {twin.error && (
          <p className="error" role="alert">
            {twin.error}
          </p>
        )}
        <p className="muted">
          Browser visualization works without Blender. Blender bridge:{" "}
          {state?.blender.connected
            ? state.blender.synchronized
              ? "synchronized"
              : "applying update"
            : "not connected"}
          .
        </p>
      </section>
      <div className="twin-toolbar">
        <Badge tone="cyan">3D WORKSPACE · SIMULATED</Badge>
        <div>
          <Button variant="outline" onClick={() => setMode(!mode)}>
            {mode ? "Incident highlights on" : "Incident highlights off"}
          </Button>
          <Button
            variant="outline"
            aria-label="Reset camera"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RotateCcw size={15} />
          </Button>
          {!bundled && (
            <Button
              variant="outline"
              onClick={() => {
                setUrl(MODEL);
                setVersion((v) => v + 1);
              }}
            >
              Restore township
            </Button>
          )}
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload size={15} />
            Preview model
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".glb"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.name.toLowerCase().endsWith(".glb")) {
                setFileError("Choose a self-contained .glb file.");
                return;
              }
              setFileError("");
              setUrl(URL.createObjectURL(file));
              setVersion((v) => v + 1);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {!bundled && (
        <p className="panel-foot">
          Uploaded preview. Live water animation requires the township model
          metadata.
        </p>
      )}
      <div className="twin-canvas">
        <Canvas
          key={version}
          camera={{ position: [24, 35, 38], fov: 42, near: 0.1, far: 500 }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => gl.setClearColor("#0c1624")}
          fallback={
            <div className="empty">WebGL is unavailable in this browser.</div>
          }
        >
          <ambientLight intensity={1.7} />
          <directionalLight position={[-12, 30, 12]} intensity={3} />
          <directionalLight position={[20, 15, -10]} intensity={1.2} />
          <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.02} />
          <ModelBoundary key={url}>
            <Suspense
              fallback={
                <Html center>
                  <div className="viewer-message">Loading township model…</div>
                </Html>
              }
            >
              <Bounds fit clip observe margin={1.12}>
                <Model
                  key={url}
                  url={url}
                  incidentMode={mode}
                  sensors={sensors}
                  incidents={incidents}
                  state={state}
                  running={twin.online}
                  receivedAt={twin.receivedAt}
                />
              </Bounds>
            </Suspense>
          </ModelBoundary>
          {bundled && state?.leak.active && (
            <Html position={[-9, 3.5, 0]} center>
              <span className="township-leak-label">
                L-01 · {state.leak.lossLps.toFixed(2)} L/s{" "}
                {twin.online ? "leak" : "(last known)"}
              </span>
            </Html>
          )}
          {sensors
            .filter((s) => s.modelPosition)
            .map((s) => (
              <mesh
                key={s.id}
                position={[
                  s.modelPosition!.x,
                  s.modelPosition!.y,
                  s.modelPosition!.z,
                ]}
                onClick={() => onSensor(s)}
              >
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial
                  color={s.status === "critical" ? "#f26373" : "#0093d3"}
                />
                <Html distanceFactor={12}>
                  <span className="marker-label">{s.id}</span>
                </Html>
              </mesh>
            ))}
        </Canvas>
      </div>
      {fileError && (
        <p className="error" role="alert">
          {fileError}
        </p>
      )}
      <div className="panel-foot">
        Illustrative township · Transparent pipes · Orbit / zoom / pan · Water
        pauses when the controller stops
      </div>
      <section
        className="township-panel"
        aria-label="Township incident history"
      >
        <div className="section-heading">
          <h3>Controller incident history</h3>
          <Badge>SIMULATED</Badge>
        </div>
        <p className="muted">
          Latest events from the township controller. Separate from municipal
          service tickets; resets when the controller restarts.
        </p>
        {twin.snapshot?.events.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Location</th>
                  <th>Loss</th>
                </tr>
              </thead>
              <tbody>
                {[...twin.snapshot.events]
                  .reverse()
                  .slice(0, 10)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.time).toLocaleTimeString()}</td>
                      <td>{e.type.replaceAll("_", " ")}</td>
                      <td>{e.state.leak.id}</td>
                      <td>{e.state.leak.lossLps.toFixed(2)} L/s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No controller incidents received.</p>
        )}
      </section>
    </div>
  );
}
