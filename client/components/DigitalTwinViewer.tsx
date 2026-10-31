import {
  Suspense,
  useEffect,
  useRef,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Center } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Mesh, MeshStandardMaterial } from "three";
import type { Sensor, Incident } from "../../shared/domain";
import { Box, RotateCcw, Upload } from "lucide-react";
import { Button, Badge } from "./ui";
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
        <div className="viewer-message">
          Unable to load model. Check GLB/GLTF format and linked resources.
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
}: {
  url: string;
  incidentMode: boolean;
  sensors: Sensor[];
  incidents: Incident[];
}) {
  const gltf = useLoader(GLTFLoader, url);
  const [scene] = useState(() => gltf.scene.clone(true));
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const original = gltf.scene.getObjectByName(obj.name) as
          Mesh | undefined;
        obj.material = original?.material || obj.material;
        const affected = sensors.some(
          (s) =>
            s.modelComponent === obj.name &&
            incidents.some(
              (i) =>
                i.assetId === s.assetId &&
                !["Resolved", "Verified", "Closed"].includes(i.status),
            ),
        );
        if (incidentMode && affected)
          obj.material = new MeshStandardMaterial({
            color: "#f26373",
            emissive: "#8b1e31",
            emissiveIntensity: 0.4,
          });
      }
    });
  }, [scene, gltf, incidentMode, sensors, incidents]);
  return <primitive object={scene} />;
}
export default function DigitalTwinViewer({
  sensors,
  incidents,
  onSensor,
}: {
  sensors: Sensor[];
  incidents: Incident[];
  onSensor: (s: Sensor) => void;
}) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch("/models/municipal-water-network.glb", { method: "HEAD" })
      .then((r) => {
        if (r.ok && !r.headers.get("content-type")?.includes("text/html"))
          setUrl("/models/municipal-water-network.glb");
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(
    () => () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="twin">
      <div className="twin-toolbar">
        <Badge tone="cyan">3D WORKSPACE</Badge>
        <div>
          <Button variant="outline" onClick={() => setMode(!mode)}>
            {mode ? "Incident view" : "Normal view"}
          </Button>
          <Button
            variant="outline"
            aria-label="Reset camera"
            onClick={() => setVersion((v) => v + 1)}
          >
            <RotateCcw size={15} />
          </Button>
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload size={15} />
            Preview model
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".glb,.gltf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setError("");
                setUrl(URL.createObjectURL(file));
                setVersion((v) => v + 1);
              }
            }}
          />
        </div>
      </div>
      <div className="twin-canvas">
        <Canvas
          key={version}
          camera={{ position: [12, 10, 12], fov: 45 }}
          onCreated={({ gl }) => gl.setClearColor("#0c1624")}
          fallback={
            <div className="empty">WebGL is unavailable in this browser.</div>
          }
        >
          <ambientLight intensity={1.4} />
          <directionalLight position={[5, 10, 5]} intensity={2} />
          <Grid
            infiniteGrid
            cellSize={1}
            sectionSize={5}
            cellColor="#213443"
            sectionColor="#325263"
            fadeDistance={60}
          />
          <OrbitControls makeDefault />
          {url && (
            <ModelBoundary key={url}>
              <Suspense fallback={<Html center>Loading model…</Html>}>
                <Model
                  url={url}
                  incidentMode={mode}
                  sensors={sensors}
                  incidents={incidents}
                />
              </Suspense>
            </ModelBoundary>
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
        {!url && (
          <div className="twin-placeholder">
            <div className="cube-icon">
              <Box size={42} strokeWidth={1} />
            </div>
            <h2>
              {loading
                ? "Checking for model…"
                : "Your infrastructure. In a new dimension."}
            </h2>
            <p>
              A dedicated workspace for your Blender water network.
              <br />
              Upload a preview, or add your model to the reserved path.
            </p>
            <code>public/models/municipal-water-network.glb</code>
            <p className="muted">Orbit · Zoom · Pan · Sensor placement ready</p>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="panel-foot">
        Visualisation only · Model previews stay in this browser · GLTF previews
        must embed their resources.
      </div>
    </div>
  );
}
