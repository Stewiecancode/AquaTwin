import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, ArrowUpDown, MapPin, Radio } from "lucide-react";
import { useData } from "../context";
import { Button, Badge, Modal, Field, Empty, date } from "../components/ui";
import { TrendChart } from "../components/Charts";
import { sensorTypes, type Sensor } from "../../shared/domain";
export function SensorsPage() {
  const d = useData();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("sensor") || "");
  const [type, setType] = useState("");
  const [sort, setSort] = useState(false);
  const [selected, setSelected] = useState<Sensor | null>(null);
  const [edit, setEdit] = useState(false);
  const [register, setRegister] = useState(false);
  const sensors = d.sensors
    .filter(
      (s) =>
        (s.id + " " + s.name).toLowerCase().includes(search.toLowerCase()) &&
        (!type || s.type === type),
    )
    .sort((a, b) =>
      sort ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
    );
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>
              Sensor registry <Badge>{d.sensors.length}</Badge>
            </h2>
            <p>Every installation, reading, and infrastructure connection.</p>
          </div>
          {d.user.role === "admin" && (
            <Button onClick={() => setRegister(true)}>
              <Plus size={16} />
              Register sensor
            </Button>
          )}
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search sensors"
              placeholder="Search by sensor name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Sensor type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All sensor types</option>
            {sensorTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setSort(!sort)}>
            <ArrowUpDown size={15} />
            Name {sort ? "Z–A" : "A–Z"}
          </Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sensor / identifier</th>
                <th>Type</th>
                <th>Zone</th>
                <th>Latest reading</th>
                <th>Status</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => {
                        setSelected(s);
                        setEdit(false);
                      }}
                    >
                      {s.name}
                    </button>
                    <small>{s.id}</small>
                  </td>
                  <td>{s.type}</td>
                  <td>{s.zone}</td>
                  <td>
                    <b>{s.reading.toFixed(2)}</b>{" "}
                    <span className="muted">{s.unit}</span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        s.status === "online"
                          ? "cyan"
                          : s.status === "offline"
                            ? "gray"
                            : s.status === "critical"
                              ? "red"
                              : "amber"
                      }
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone="gray">{s.source}</Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelected(s);
                        setEdit(false);
                      }}
                    >
                      Details →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sensors.length && (
            <Empty>
              No matching sensors. Adjust your search or register an
              installation.
            </Empty>
          )}
        </div>
      </section>
      <Modal
        title={edit ? "Edit sensor installation" : "Sensor details"}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected &&
          (edit ? (
            <SensorForm sensor={selected} onSaved={() => setSelected(null)} />
          ) : (
            <>
              <Badge>{selected.source}</Badge>
              <h2>{selected.name}</h2>
              <p className="muted">{selected.id}</p>
              <div className="reading-value">
                {d.sensors
                  .find((s) => s.id === selected.id)
                  ?.reading.toFixed(2)}{" "}
                <span>{selected.unit}</span>
              </div>
              <TrendChart
                readings={d.readings.filter((r) => r.sensorId === selected.id)}
                unit={selected.unit}
              />
              <div className="detail-grid">
                <div>
                  <small>Location</small>
                  {selected.location}
                  <p>
                    {selected.gps.lat}, {selected.gps.lng}
                  </p>
                </div>
                <div>
                  <small>Infrastructure</small>
                  {selected.assetId}
                  <p>
                    {selected.zone} · {selected.ward}
                  </p>
                </div>
                <div>
                  <small>Last maintained</small>
                  {selected.lastMaintenance || "Not recorded"}
                </div>
                <div>
                  <small>Calibration</small>
                  {selected.calibrationDate || "Not recorded"}
                </div>
                <div>
                  <small>Installed</small>
                  {selected.installedAt}
                </div>
                <div>
                  <small>Operating range</small>
                  {selected.normalMin}–{selected.normalMax} {selected.unit}
                </div>
              </div>
              <h3>Infrastructure maintenance history</h3>
              {d.incidents
                .filter((i) => i.assetId === selected.assetId)
                .map((i) => (
                  <p key={i.id}>
                    {i.reference} · {i.status} · {i.team || "Unassigned"}
                  </p>
                ))}
              {d.user.role === "admin" && (
                <Button onClick={() => setEdit(true)}>
                  Edit sensor & placement
                </Button>
              )}
            </>
          ))}
      </Modal>
      <Modal
        title="Register sensor"
        open={register}
        onClose={() => setRegister(false)}
      >
        {register && <SensorForm onSaved={() => setRegister(false)} />}
      </Modal>
    </>
  );
}
export function SensorForm({
  sensor,
  onSaved,
}: {
  sensor?: Sensor;
  onSaved: () => void;
}) {
  const d = useData();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(sensor?.type || "Flow");
  const input = (
    name: string,
    label: string,
    value: unknown = "",
    kind = "text",
    required = true,
  ) => (
    <Field label={label}>
      <input
        name={name}
        type={kind}
        step={kind === "number" ? "any" : undefined}
        defaultValue={String(value ?? "")}
        required={required}
      />
    </Field>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const str = (n: string) => String(f.get(n) || "");
        const n = (name: string) => Number(f.get(name));
        const payload = {
          id: str("id"),
          name: str("name"),
          type,
          municipality: d.user.municipality,
          ward: str("ward"),
          zone: str("zone"),
          location: str("location"),
          gps: { lat: n("lat"), lng: n("lng") },
          assetId: str("assetId"),
          installedAt: str("installedAt"),
          lastMaintenance: str("lastMaintenance"),
          calibrationDate: str("calibrationDate"),
          calibration: { offset: n("offset"), scale: n("scale") },
          manufacturer: str("manufacturer"),
          model: str("model"),
          unit: str("unit"),
          normalMin: n("normalMin"),
          normalMax: n("normalMax"),
          warning: n("warning"),
          critical: n("critical"),
          source: str("source"),
          modelPosition:
            str("x") !== "" && str("y") !== "" && str("z") !== ""
              ? { x: n("x"), y: n("y"), z: n("z") }
              : null,
          modelComponent: str("modelComponent"),
        };
        try {
          await d.perform(
            sensor ? `/sensors/${sensor.id}` : "/sensors",
            sensor ? "PATCH" : "POST",
            payload,
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {input("id", "Unique sensor ID", sensor?.id || "AQ-MHK-")}
        {input("name", "Descriptive name", sensor?.name)}
        <Field label="Sensor type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Sensor["type"])}
          >
            {sensorTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {input("unit", "Measurement unit", sensor?.unit || "L/min")}
        <Field label="Zone">
          <select name="zone" defaultValue={sensor?.zone || "Zone A"}>
            {["Zone A", "Zone B", "Zone C"].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        {input("ward", "Ward", sensor?.ward || "Ward 1")}
        {input("location", "Installation location", sensor?.location)}
        <Field label="Infrastructure asset">
          <select
            name="assetId"
            defaultValue={sensor?.assetId || d.assets[0]?.id}
          >
            {d.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {input("lat", "Latitude", sensor?.gps.lat ?? -25.85, "number")}
        {input("lng", "Longitude", sensor?.gps.lng ?? 25.65, "number")}
        {input(
          "installedAt",
          "Installation date",
          sensor?.installedAt || new Date().toISOString().slice(0, 10),
          "date",
        )}
        {input(
          "lastMaintenance",
          "Last maintenance date",
          sensor?.lastMaintenance,
          "date",
          false,
        )}
        {input(
          "manufacturer",
          "Manufacturer",
          sensor?.manufacturer || "Demo instruments",
        )}
        {input("model", "Model", sensor?.model || "Virtual sensor")}
        {input(
          "normalMin",
          "Normal minimum",
          sensor?.normalMin ?? 80,
          "number",
        )}
        {input(
          "normalMax",
          "Normal maximum",
          sensor?.normalMax ?? 160,
          "number",
        )}
        {input(
          "warning",
          "High warning threshold",
          sensor?.warning ?? 160,
          "number",
        )}
        {input(
          "critical",
          "High critical threshold",
          sensor?.critical ?? 200,
          "number",
        )}
        {input(
          "calibrationDate",
          "Calibration date",
          sensor?.calibrationDate,
          "date",
          false,
        )}
        {input(
          "offset",
          "Calibration offset",
          sensor?.calibration.offset ?? 0,
          "number",
        )}
        {input(
          "scale",
          "Calibration scale",
          sensor?.calibration.scale ?? 1,
          "number",
        )}
        <Field label="Data source">
          <select name="source" defaultValue={sensor?.source || "SIMULATED"}>
            {(sensor
              ? [sensor.source]
              : d.settings.demo
                ? ["SIMULATED", "MANUAL"]
                : ["LIVE", "MANUAL"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <h3>Digital twin placement</h3>
      <p className="muted">
        Leave coordinates blank until your Blender model is ready. Coordinates
        use the model's unscaled world space.
      </p>
      <div className="form-grid">
        {input(
          "modelComponent",
          "Blender mesh / component name",
          sensor?.modelComponent,
          "text",
          false,
        )}
        {input("x", "Model X", sensor?.modelPosition?.x, "number", false)}
        {input("y", "Model Y", sensor?.modelPosition?.y, "number", false)}
        {input("z", "Model Z", sensor?.modelPosition?.z, "number", false)}
      </div>
      {error && <p className="error">{error}</p>}
      <Button disabled={busy}>
        {busy ? "Saving…" : sensor ? "Save sensor" : "Register sensor"}
      </Button>
    </form>
  );
}
