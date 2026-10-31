import { useState } from "react";
import { ClipboardList, Plus, Search, CheckCircle2 } from "lucide-react";
import { useData } from "../context";
import { Button, Badge, Modal, Field, Empty, date } from "../components/ui";
import { statuses, type Incident } from "../../shared/domain";
export async function readPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPEG, PNG or WebP photograph");
  if (file.size > 1000000) throw Error("Photo must be smaller than 1 MB");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("Image processing unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.8;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 140000 && quality > 0.15) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 140000)
    throw Error("Image is too complex. Please choose a smaller photograph.");
  return data;
}
export function IncidentsPage() {
  const d = useData();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [id, setId] = useState<string | null>(null);
  const selected = d.incidents.find((i) => i.id === id);
  const items = d.incidents.filter(
    (i) =>
      (!status || i.status === status) &&
      (i.reference + " " + i.description + " " + i.team)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="workflow-strip">
        {statuses.map((s, i) => (
          <span key={s}>
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Incident accountability register</h2>
            <p>From community report to independently verified closure.</p>
          </div>
          <Badge>{d.incidents.length} records</Badge>
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search incidents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, description or team…"
            />
          </div>
          <select
            aria-label="Incident status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned team</th>
                <th>Reported</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <button className="table-link" onClick={() => setId(i.id)}>
                      {i.reference}
                    </button>
                    <small>
                      {i.category} · {i.source}
                    </small>
                  </td>
                  <td>
                    {i.location}
                    <small>{i.zone}</small>
                  </td>
                  <td>
                    <Badge tone={i.priority === "Critical" ? "red" : "amber"}>
                      {i.priority}
                    </Badge>
                  </td>
                  <td>{i.status}</td>
                  <td>{i.team || "Unassigned"}</td>
                  <td>{date(i.createdAt)}</td>
                  <td>
                    <Button variant="outline" onClick={() => setId(i.id)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <Empty>No incidents match this view.</Empty>}
        </div>
      </section>
      <Modal
        title={selected?.reference || "Incident"}
        open={!!selected}
        onClose={() => setId(null)}
      >
        {selected && <IncidentEditor key={selected.id} incident={selected} />}
      </Modal>
    </>
  );
}
function IncidentEditor({ incident: i }: { incident: Incident }) {
  const d = useData();
  const [notes, setNotes] = useState(i.notes);
  const [team, setTeam] = useState(i.team || "Team Alpha");
  const [target, setTarget] = useState(
    i.targetAt
      ? new Date(Date.parse(i.targetAt) + 7200000).toISOString().slice(0, 16)
      : new Date(Date.now() + 93600000).toISOString().slice(0, 16),
  );
  const [priority, setPriority] = useState(i.priority);
  const [zone, setZone] = useState(i.zone);
  const [asset, setAsset] = useState(i.assetId);
  const [cost, setCost] = useState(i.cost);
  const [materials, setMaterials] = useState(i.materials);
  const [photos, setPhotos] = useState(i.evidence);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const staff = d.user.role !== "technician";
  const act = async (path: string, method: string, body: unknown) => {
    setBusy(true);
    setError("");
    try {
      await d.perform(path, method, body);
      d.notify("Incident updated and audit history recorded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = (status?: string, reopen = false) =>
    act(`/incidents/${i.id}`, "PATCH", {
      notes,
      cost: Number(cost),
      materials,
      evidence: photos,
      ...(staff ? { priority, zone, assetId: asset } : {}),
      ...(status ? { status } : {}),
      ...(reopen ? { reopen: true } : {}),
    });
  return (
    <>
      <div className="incident-summary">
        <Badge tone={i.source === "SIMULATED" ? "amber" : "cyan"}>
          {i.source}
        </Badge>
        <Badge>{i.status}</Badge>
        <h3>{i.description}</h3>
        <p className="muted">
          {i.location} · {i.gps.lat.toFixed(5)}, {i.gps.lng.toFixed(5)}
        </p>
        <p className="muted">
          Department: {i.department} · Owner: {i.team || "Awaiting assignment"}
        </p>
      </div>
      <div className="form-grid">
        <Field label="Priority">
          <select
            disabled={!staff}
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value as Incident["priority"])
            }
          >
            {["Minor", "Moderate", "Critical"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Zone">
          <select
            disabled={!staff}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          >
            {["Unmapped", "Zone A", "Zone B", "Zone C"].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Infrastructure association">
          <select
            disabled={!staff}
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          >
            <option value="">Not mapped</option>
            {d.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maintenance team">
          <select
            disabled={!staff}
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {["Team Alpha", "Team Bravo", "Reservoir Unit"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Target response (SAST)">
          <input
            disabled={!staff}
            type="datetime-local"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="Repair cost (ZAR)">
          <input
            min="0"
            type="number"
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="Repair / resolution / verification notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Describe the inspection, repair, or verification evidence…"
        />
      </Field>
      <Field label="Parts and materials used">
        <input
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
        />
      </Field>
      <Field label="Add repair evidence (JPEG, PNG, WebP · max 1 MB each)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file)
              try {
                if (photos.length >= 6) throw Error("Maximum six photographs");
                const data = await readPhoto(file);
                setPhotos([
                  ...photos,
                  {
                    name: file.name,
                    data,
                    stage: ["Resolved", "Verified", "Closed"].includes(i.status)
                      ? "after"
                      : "before",
                  },
                ]);
              } catch (e) {
                setError((e as Error).message);
              }
          }}
        />
      </Field>
      <div className="evidence">
        {photos.map((p, index) => (
          <div key={index}>
            <img src={p.data} alt={p.name} />
            <select
              aria-label={`Evidence stage ${index + 1}`}
              value={p.stage}
              onChange={(e) =>
                setPhotos(
                  photos.map((item, j) =>
                    j === index
                      ? { ...item, stage: e.target.value as typeof p.stage }
                      : item,
                  ),
                )
              }
            >
              <option value="report">Report</option>
              <option value="before">Before repair</option>
              <option value="after">After repair</option>
            </select>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="action-wrap">
        <Button variant="outline" disabled={busy} onClick={() => update()}>
          Save repair details
        </Button>
        {i.status === "Reported" && staff && (
          <Button disabled={busy} onClick={() => update("Validated")}>
            Validate report
          </Button>
        )}
        {["Validated", "Assigned"].includes(i.status) && staff && (
          <Button
            disabled={busy || !target}
            onClick={() =>
              act(`/incidents/${i.id}/assign`, "POST", {
                team,
                targetAt: new Date(`${target}+02:00`).toISOString(),
              })
            }
          >
            Assign to {team}
          </Button>
        )}
        {i.status === "Assigned" && (
          <Button disabled={busy} onClick={() => update("In Progress")}>
            Start repair
          </Button>
        )}
        {i.status === "In Progress" && (
          <Button
            disabled={busy || !notes.trim()}
            onClick={() => update("Resolved")}
          >
            Record resolution
          </Button>
        )}
        {i.status === "Resolved" && staff && (
          <Button
            disabled={busy || notes.trim().length < 5}
            onClick={() => act(`/incidents/${i.id}/verify`, "POST", { notes })}
          >
            Verify completed repair
          </Button>
        )}
        {i.status === "Verified" && staff && (
          <Button disabled={busy} onClick={() => update("Closed")}>
            Close incident
          </Button>
        )}
        {["Resolved", "Verified", "Closed"].includes(i.status) && staff && (
          <Button
            variant="outline"
            disabled={busy || !notes.trim()}
            onClick={() => update("Validated", true)}
          >
            Reopen with notes
          </Button>
        )}
      </div>
      <h3 className="timeline-title">Accountability timeline</h3>
      <div className="timeline">
        {i.history
          .slice()
          .reverse()
          .map((h, index) => (
            <div key={index}>
              <span className="dot" />
              <div>
                <b>{h.status}</b>
                <small>
                  {date(h.at)} · {h.by}
                </small>
                <p>{h.note}</p>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
export function MaintenancePage() {
  const d = useData();
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Preventive maintenance</h2>
          <p>Scheduled work and accountable field actions.</p>
        </div>
        {d.user.role !== "technician" && (
          <Button onClick={() => setModal(true)}>
            <Plus size={16} />
            Schedule maintenance
          </Button>
        )}
      </div>
      <div className="grid-three">
        {d.tasks.map((t) => (
          <section className="panel task-card" key={t.id}>
            <Badge>{t.status}</Badge>
            <h3>{t.title}</h3>
            <p>
              {t.team} · {t.zone}
            </p>
            <p className="muted">Due {date(t.targetAt)}</p>
            {t.status !== "Completed" && (
              <Button
                variant="outline"
                onClick={() =>
                  d
                    .perform(`/maintenance/tasks/${t.id}`, "PATCH", {
                      status:
                        t.status === "Scheduled" ? "In Progress" : "Completed",
                    })
                    .catch(() => {})
                }
              >
                {t.status === "Scheduled" ? "Start task" : "Complete task"}
              </Button>
            )}
          </section>
        ))}
      </div>
      {!d.tasks.length && <Empty>No preventive maintenance scheduled.</Empty>}
      <IncidentsPage />
      <Modal
        title="Schedule preventive maintenance"
        open={modal}
        onClose={() => setModal(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await d.perform("/maintenance/tasks", "POST", {
                title: f.get("title"),
                team: f.get("team"),
                zone: f.get("zone"),
                targetAt: new Date(`${f.get("target")}+02:00`).toISOString(),
              });
              setModal(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Field label="Inspection or maintenance task">
            <input required minLength={3} name="title" />
          </Field>
          <Field label="Responsible team">
            <select name="team">
              {["Team Alpha", "Team Bravo", "Reservoir Unit"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Zone">
            <select name="zone">
              {["Zone A", "Zone B", "Zone C"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Target date (SAST)">
            <input required type="datetime-local" name="target" />
          </Field>
          {error && <p className="error">{error}</p>}
          <Button>Schedule task</Button>
        </form>
      </Modal>
    </>
  );
}
