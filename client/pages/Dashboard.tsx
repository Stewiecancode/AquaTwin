import { ViewerBoundary } from "../components/ViewerBoundary";
import { useState, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Radio,
  Droplets,
  Gauge,
  Waves,
  TriangleAlert,
  ArrowUpRight,
  ArrowRight,
  Download,
  Play,
  Square,
  CheckCircle2,
  Clock,
  Wrench,
  Box,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../context";
import { Button, Badge, Field, Empty, Modal, date } from "../components/ui";
import { TrendChart, Bars } from "../components/Charts";
import InfrastructureMap from "../components/InfrastructureMap";
import { exportCsv } from "../api";
import { SensorForm } from "./Sensors";
import {
  pipeDiametersMm,
  pipeFlowLimitsLpm,
  pipeVelocityLimitsMps,
  type Asset,
  type Sensor,
} from "../../shared/domain";
const DigitalTwinViewer = lazy(() => import("../components/DigitalTwinViewer"));
const num = (n: number, d = 0) =>
  n.toLocaleString("en-ZA", { maximumFractionDigits: d });
export function Kpis() {
  const { summary: s } = useData();
  const cards = [
    {
      label: "Registered sensors",
      value: s.totalSensors,
      unit: "sensors",
      icon: Radio,
      detail: `${s.online} online · ${s.offline} offline`,
      tone: "cyan",
    },
    {
      label: "Network water flow",
      value: num(s.flow, 1),
      unit: "L/min",
      icon: Waves,
      detail: "Sum of online flow sensors",
      tone: "cyan",
    },
    {
      label: "Average pressure",
      value: num(s.pressure, 2),
      unit: "bar",
      icon: Gauge,
      detail: "Online pressure transducers",
      tone: "blue",
    },
    {
      label: "Reservoir level",
      value: num(s.level, 1),
      unit: "%",
      icon: Droplets,
      detail: "Hydrostatic level measurement",
      tone: "blue",
    },
    {
      label: "Suspected leaks",
      value: s.leaks,
      unit: "active",
      icon: TriangleAlert,
      detail: "Requires field verification",
      tone: s.leaks ? "amber" : "cyan",
    },
    {
      label: "Open incidents",
      value: s.openTickets,
      unit: "cases",
      icon: Wrench,
      detail: `${s.resolved} resolved incidents`,
      tone: "purple",
    },
  ];
  return (
    <div className="kpi-grid">
      {cards.map(({ label, value, unit, icon: Icon, detail, tone }) => (
        <div className={`kpi ${tone}`} key={label}>
          <div className="kpi-label">
            {label}
            <Icon size={17} />
          </div>
          <div className="kpi-value">
            {value}
            <span>{unit}</span>
          </div>
          <div className="kpi-detail">
            <span className="mini-dot" />
            {detail}
          </div>
        </div>
      ))}
    </div>
  );
}
export function Overview() {
  const d = useData();
  const flow = d.sensors.find((s) => s.type === "Flow");
  return (
    <>
      <div className="data-banner">
        <span className="dot" />
        <b>
          {d.settings.demo
            ? "Demonstration network is running"
            : "Water network monitoring"}
        </b>
        <span>
          {d.settings.demo
            ? "All telemetry below is SIMULATED. Asset locations are fictional."
            : "Measurements retain their LIVE or MANUAL source labels."}
        </span>
        <Link to="/monitoring">
          View stream <ArrowRight size={14} />
        </Link>
      </div>
      <Kpis />
      <div className="dashboard-grid">
        <section className="panel flow-panel">
          <div className="section-heading">
            <div>
              <h2>Water flow activity</h2>
              <p>
                {flow?.name || "No flow sensor"} · {flow?.source || "No data"}
              </p>
            </div>
            <Badge tone="cyan">
              <span className="dot" />
              5s refresh
            </Badge>
          </div>
          <div className="chart-key">
            <span className="cyan-line" />
            Measured flow <span className="gray-line" />
            Baseline <span className="chart-unit">L/min</span>
          </div>
          <TrendChart
            readings={d.readings.filter((r) => r.sensorId === flow?.id)}
            unit="L/min"
            baseline
          />
          <div className="panel-foot">
            <Activity size={14} /> Sensor history from the backend{" "}
            <span>
              Updated{" "}
              {new Date(d.summary.updatedAt).toLocaleTimeString("en-ZA", {
                timeZone: "Africa/Johannesburg",
              })}
            </span>
          </div>
        </section>
        <section className="panel map-panel">
          <div className="section-heading">
            <div>
              <h2>Network at a glance</h2>
              <p>Synthetic demonstration infrastructure</p>
            </div>
            <Link className="text-link" to="/map">
              Expand <ArrowUpRight size={15} />
            </Link>
          </div>
          <InfrastructureMap
            sensors={d.sensors}
            assets={d.assets}
            incidents={d.incidents}
          />
          <div className="map-legend">
            <span>
              <i className="legend-dot teal" />
              Online
            </span>
            <span>
              <i className="legend-dot amber" />
              Incident
            </span>
            <span>
              <i className="legend-dot blue" />
              Reservoir
            </span>
            <span>
              <i className="legend-dot purple" />
              Pump station
            </span>
          </div>
        </section>
        <section className="panel incidents-panel">
          <div className="section-heading">
            <div>
              <h2>
                Incidents requiring attention{" "}
                <Badge tone="amber">{d.summary.openTickets}</Badge>
              </h2>
              <p>Clear ownership. Traceable action.</p>
            </div>
            <Link className="text-link" to="/incidents">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference / incident</th>
                  <th>Zone</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.incidents
                  .filter((i) => !["Verified", "Closed"].includes(i.status))
                  .slice(0, 4)
                  .map((i) => (
                    <tr key={i.id}>
                      <td>
                        <b>{i.reference}</b>
                        <small>
                          {i.category} ·{" "}
                          {i.source === "SIMULATED"
                            ? "Demo incident"
                            : "Community report"}
                        </small>
                      </td>
                      <td>{i.zone}</td>
                      <td>
                        <Badge
                          tone={i.priority === "Critical" ? "red" : "amber"}
                        >
                          {i.priority}
                        </Badge>
                      </td>
                      <td>
                        <span className="status-label">{i.status}</span>
                      </td>
                      <td>
                        {i.team || <span className="muted">Unassigned</span>}
                      </td>
                      <td>
                        <Link
                          to="/incidents"
                          aria-label={`Review ${i.reference}`}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!d.incidents.length && <Empty>No incidents in this view.</Empty>}
          </div>
        </section>
        <section className="panel performance-panel">
          <div className="section-heading">
            <div>
              <h2>Service delivery</h2>
              <p>Accountability, measured</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="performance-score">
            <span>
              {num(d.summary.performance)}
              <small>%</small>
            </span>
            <div>
              Verified closure rate<small>Of incidents in this view</small>
            </div>
          </div>
          <div className="progress-track">
            <span style={{ width: `${d.summary.performance}%` }} />
          </div>
          <div className="metric-row">
            <span>Average assignment time</span>
            <b>
              {d.summary.responseHours === null
                ? "Awaiting assignment"
                : `${num(d.summary.responseHours, 1)} h`}
            </b>
          </div>
          <div className="metric-row">
            <span>Estimated excess flow loss</span>
            <b>{num(d.summary.losses)} L</b>
          </div>
          <p className="fine-print">
            Estimate integrates simulated flow above baseline. This is not
            measured water loss.
          </p>
          <Link to="/analytics" className="text-link">
            Explore service insights <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="twin-callout">
        <div className="cube-icon">
          <Box size={28} />
        </div>
        <div>
          <Badge>BLENDER READY</Badge>
          <h3>Bring your water network into focus.</h3>
          <p>Your digital twin workspace is ready for a GLB or GLTF model.</p>
        </div>
        <Link to="/digital-twin" className="button outline">
          Open digital twin <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
export function Monitoring() {
  const d = useData();
  return (
    <>
      <Kpis />
      <div className="grid-two">
        {d.sensors.map((s) => (
          <section className="panel" key={s.id}>
            <div className="section-heading">
              <div>
                <h2>{s.name}</h2>
                <p>
                  {s.id} · {s.source}
                </p>
              </div>
              <Badge
                tone={
                  s.status === "online"
                    ? "cyan"
                    : s.status === "critical"
                      ? "red"
                      : "amber"
                }
              >
                {s.status}
              </Badge>
            </div>
            <div className="reading-value">
              {num(s.reading, 2)} <span>{s.unit}</span>
            </div>
            <TrendChart
              readings={d.readings.filter((r) => r.sensorId === s.id)}
              unit={s.unit}
              baseline
            />
            <div className="panel-foot">
              Last successful reading {date(s.updatedAt)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
export function Simulations() {
  const d = useData();
  return (
    <>
      <div className="notice">
        <TriangleAlert size={20} />
        <div>
          <b>Suspected Leak — Requires Verification</b>
          <p>
            A rise in flow and drop in pressure can indicate an anomaly.
            Simulation is synthetic and never controls physical devices.
          </p>
        </div>
        {d.user.role !== "technician" && d.settings.demo && (
          <Button onClick={d.simulate}>
            <Play size={15} />
            New simulation
          </Button>
        )}
      </div>
      <div className="grid-two">
        {d.sensors
          .filter((s) => ["Flow", "Pressure"].includes(s.type))
          .map((s) => (
            <section className="panel" key={s.id}>
              <div className="section-heading">
                <div>
                  <h2>{s.name}</h2>
                  <p>{s.source} · Baseline compared with readings</p>
                </div>
                <Badge>
                  {num(s.reading, 2)} {s.unit}
                </Badge>
              </div>
              <TrendChart
                readings={d.readings.filter((r) => r.sensorId === s.id)}
                unit={s.unit}
                baseline
              />
            </section>
          ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Simulation sessions</h2>
          <Badge>{d.simulations.length} recorded</Badge>
        </div>
        {d.simulations.length ? (
          d.simulations
            .slice()
            .reverse()
            .map((s) => (
              <div className="session-row" key={s.id}>
                <span className={`dot ${s.stoppedAt ? "gray" : ""}`} />
                <div>
                  <b>
                    {s.zone} · {s.severity} anomaly
                  </b>
                  <small>
                    {s.id} · {date(s.startedAt)}
                  </small>
                  <p>
                    {s.incidentId
                      ? "Threshold triggered → incident created"
                      : "Monitoring configured thresholds"}
                  </p>
                </div>
                <Badge tone={s.stoppedAt ? "gray" : "cyan"}>
                  {s.stoppedAt ? "Stopped" : "Running"}
                </Badge>
                {!s.stoppedAt && d.user.role !== "technician" && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      d
                        .perform(`/simulations/${s.id}/stop`, "POST")
                        .catch(() => {})
                    }
                  >
                    <Square size={13} />
                    Stop simulation
                  </Button>
                )}
              </div>
            ))
        ) : (
          <Empty>
            Start a simulation to see the detection workflow in action.
          </Empty>
        )}
      </section>
    </>
  );
}
export function Analytics() {
  const d = useData();
  return (
    <>
      <Kpis />
      <div className="grid-two">
        <section className="panel">
          <div className="section-heading">
            <h2>Incidents by zone</h2>
            <Badge>Historical records</Badge>
          </div>
          <Bars data={d.analytics.zones} />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Verified maintenance closures</h2>
          </div>
          <Bars data={d.analytics.zones} y="closed" />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Monthly incident comparison</h2>
          </div>
          <Bars data={d.analytics.monthly} x="month" />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Quarterly incident comparison</h2>
          </div>
          <Bars data={d.analytics.quarterly} x="quarter" />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Sensor connectivity</h2>
          </div>
          <Bars
            data={[
              { zone: "Online", incidents: d.summary.online },
              { zone: "Offline", incidents: d.summary.offline },
            ]}
          />
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Future Service Delivery Insights</h2>
            <Activity size={18} />
          </div>
          <div className="insights">
            {d.analytics.insights.length ? (
              d.analytics.insights.map((text: string) => (
                <div key={text}>
                  <TriangleAlert size={17} />
                  {text}
                </div>
              ))
            ) : (
              <p>
                No recurring-fault or overdue-target rules triggered in this
                view.
              </p>
            )}
            <p className="fine-print">
              Transparent rules: 2+ incidents per zone, overdue open targets,
              and offline sensors. These are inspection prompts, not validated
              predictions.
            </p>
          </div>
        </section>
      </div>
      <Monitoring />
    </>
  );
}
export function Reports() {
  const d = useData();
  const [kind, setKind] = useState("incidents");
  return (
    <section className="panel report-panel">
      <FileIcon />
      <h2>Operational reports</h2>
      <p className="muted">
        Export the current network and date filters as CSV. Contact details,
        tracking keys, and private notes are excluded.
      </p>
      <Field label="Report dataset">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="incidents">Incident accountability register</option>
          <option value="readings">Sensor measurement history</option>
        </select>
      </Field>
      <Button
        disabled={d.user.role === "technician"}
        onClick={() =>
          exportCsv(kind, d.query).catch((e) => d.notify(e.message))
        }
      >
        <Download size={16} />
        Export CSV
      </Button>
      <div className="notice">
        {d.settings.demo
          ? "Demo measurements are exported with SIMULATED labels."
          : "Data source labels are included in the export."}
      </div>
    </section>
  );
}
function FileIcon() {
  return (
    <div className="cube-icon">
      <Download size={30} />
    </div>
  );
}
function PipeThresholdForm({ asset }: { asset: Asset }) {
  const d = useData();
  const [diameter, setDiameter] = useState(
    asset.nominalDiameterMm?.toString() || "",
  );
  const [flowLimit, setFlowLimit] = useState(
    asset.maxSafeFlowLpm?.toString() || "",
  );
  const [velocityLimit, setVelocityLimit] = useState(
    asset.maxSafeVelocityMps?.toString() || "",
  );
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = d.user.role === "admin";
  return (
    <form
      className="pipe-threshold-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaved("");
        setError("");
        try {
          await d.perform(`/infrastructure/${asset.id}`, "PATCH", {
            nominalDiameterMm: diameter,
            maxSafeFlowLpm: Number(flowLimit),
            maxSafeVelocityMps: Number(velocityLimit),
          });
          setSaved("Pipe thresholds saved.");
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not save thresholds.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{asset.name}</h3>
      <div className="pipe-threshold-fields">
        <Field label="Nominal diameter (DN)">
          <select
            required
            value={diameter}
            disabled={!editable || busy}
            onChange={(e) => {
              const value = e.target.value;
              setDiameter(value);
              if (!value) {
                setFlowLimit("");
                setVelocityLimit("");
                return;
              }
              const dn = Number(value) as (typeof pipeDiametersMm)[number];
              setFlowLimit(String(pipeFlowLimitsLpm[dn]));
              setVelocityLimit(String(pipeVelocityLimitsMps[dn]));
            }}
          >
            <option value="">Select pipe diameter</option>
            {pipeDiametersMm.map((dn) => (
              <option key={dn} value={dn}>
                DN {dn}
                {dn === 75 || dn === 110 ? "+" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maximum safe flow (L/min)">
          <input
            type="number"
            min="1"
            max="100000"
            step="any"
            required
            value={flowLimit}
            disabled={!editable || busy || !diameter}
            onChange={(e) => setFlowLimit(e.target.value)}
          />
        </Field>
        <Field label="Maximum safe velocity (m/s)">
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            required
            value={velocityLimit}
            disabled={!editable || busy || !diameter}
            onChange={(e) => setVelocityLimit(e.target.value)}
          />
        </Field>
      </div>
      {diameter && (
        <p className="fine-print">
          Guide value for DN {diameter}
          {Number(diameter) >= 75 ? "+" : ""}; the flow limit is checked against
          L/min telemetry. Velocity is stored as a design guide, not calculated
          from sensor data. Adjust both to verified local pipe specifications.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {saved && (
        <p className="pipe-saved" role="status">
          {saved}
        </p>
      )}
      {editable && (
        <Button type="submit" disabled={busy || !diameter}>
          {busy ? "Saving…" : "Save pipe thresholds"}
        </Button>
      )}
    </form>
  );
}
export function SettingsPage() {
  const d = useData();
  const [flow, setFlow] = useState(d.settings.flowIncrease);
  const [pressure, setPressure] = useState(d.settings.pressureDrop);
  const [reset, setReset] = useState(false);
  const [saved, setSaved] = useState("");
  return (
    <div className="grid-two">
      <section className="panel form-panel">
        <h2>Anomaly detection rules</h2>
        <p className="muted">
          Both rules must trigger in the same simulation session.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await d.perform("/settings", "PATCH", {
                flowIncrease: Number(flow),
                pressureDrop: Number(pressure),
              });
              setSaved("Detection rules saved.");
            } catch {}
          }}
        >
          <Field label="Flow increase above baseline (%)">
            <input
              type="number"
              min="1"
              max="100"
              required
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
            />
          </Field>
          <Field label="Pressure decrease below baseline (%)">
            <input
              type="number"
              min="1"
              max="90"
              required
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
            />
          </Field>
          <Button disabled={d.user.role !== "admin"}>
            Save detection rules
          </Button>
          {saved && <p role="status">{saved}</p>}
        </form>
      </section>
      <section className="panel form-panel">
        <h2>Environment & data</h2>
        <div className="metric-row">
          <span>Storage</span>
          <b>{d.settings.storage}</b>
        </div>
        <div className="metric-row">
          <span>Environment</span>
          <Badge tone="amber">{d.settings.demo ? "DEMO" : "PRODUCTION"}</Badge>
        </div>
        <div className="metric-row">
          <span>Access role</span>
          <b>{d.user.role}</b>
        </div>
        <p className="muted">
          Demo telemetry is retained for 24 hours. Incidents, repair actions,
          and status histories persist until the demo is reset.
        </p>
        {d.settings.demo && d.user.role === "admin" && (
          <Button variant="destructive" onClick={() => setReset(true)}>
            Reset demo data
          </Button>
        )}
      </section>
      <section className="panel form-panel pipe-thresholds">
        <h2>Pipe capacity thresholds</h2>
        <p className="muted">
          Set each pipeline’s nominal diameter and safe flow limit. Exceeding
          the flow limit marks its flow sensor critical; during a simulation it
          also raises a suspected-leak incident. These approximate limits are
          guidance, not engineering design.
        </p>
        {d.assets
          .filter((asset) => asset.type === "pipeline")
          .map((asset) => (
            <PipeThresholdForm key={asset.id} asset={asset} />
          ))}
      </section>
      <Modal
        title="Reset the demonstration?"
        open={reset}
        onClose={() => setReset(false)}
      >
        <p>
          This removes demo reports, sensor changes, simulations, and repair
          history, then restores the fictional baseline network.
        </p>
        <Button
          variant="destructive"
          onClick={async () => {
            try {
              await d.perform("/demo/reset", "POST");
              setReset(false);
              d.notify("Demo reset to its original baseline.");
            } catch {}
          }}
        >
          Reset demo
        </Button>
      </Modal>
    </div>
  );
}
export function MapPage() {
  const d = useData();
  return (
    <section className="panel full-map">
      <div className="section-heading">
        <div>
          <h2>Municipal infrastructure</h2>
          <p>
            Fictional demonstration locations. Not verified municipal GIS data.
          </p>
        </div>
        <Link to="/sensors" className="text-link">
          Manage sensor locations <ArrowRight size={15} />
        </Link>
      </div>
      <InfrastructureMap
        sensors={d.sensors}
        assets={d.assets}
        incidents={d.incidents}
      />
    </section>
  );
}
export function TwinPage() {
  const d = useData();
  const [selected, setSelected] = useState<Sensor | null>(null);
  return (
    <>
      <ViewerBoundary>
      <Suspense fallback={<Empty>Loading 3D workspace…</Empty>}>
        <DigitalTwinViewer
          sensors={d.sensors}
          incidents={d.incidents}
          onSensor={setSelected}
          canControl={d.user.role === "admin" || d.user.role === "operator"}
        />
      </Suspense>
      </ViewerBoundary>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Sensor placement</h2>
            <p>
              Saved model coordinates and mesh names connect the visual layer to
              registered assets.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sensor</th>
                <th>Model component</th>
                <th>Coordinates X / Y / Z</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.sensors.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    <small>{s.id}</small>
                  </td>
                  <td>{s.modelComponent || "Not linked"}</td>
                  <td>
                    {s.modelPosition
                      ? `${s.modelPosition.x} / ${s.modelPosition.y} / ${s.modelPosition.z}`
                      : "Not placed"}
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      disabled={d.user.role !== "admin"}
                      onClick={() => setSelected(s)}
                    >
                      Configure placement
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        title="Configure sensor & model placement"
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <SensorForm sensor={selected} onSaved={() => setSelected(null)} />
        )}
      </Modal>
    </>
  );
}
