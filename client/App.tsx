import { useEffect, useState, lazy, Suspense } from "react";
import {
  NavLink,
  Link,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  Droplets,
  LayoutDashboard,
  Activity,
  Box,
  Radio,
  TriangleAlert,
  ClipboardList,
  Wrench,
  ChartNoAxesCombined,
  Map,
  Bell,
  FileChartColumn,
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  ArrowUpRight,
  Play,
  Wifi,
  Search,
} from "lucide-react";
import {
  api,
  base,
  getToken,
  loginDemo,
  loginFirebase,
  logout,
  queryClient,
} from "./api";
import { DataContext, type User } from "./context";
import { Button, Badge, Modal, Field, date } from "./components/ui";
import {
  Overview,
  Monitoring,
  Simulations,
  Analytics,
  Reports,
  SettingsPage,
  TwinPage,
  MapPage,
} from "./pages/Dashboard";
import { SensorsPage } from "./pages/Sensors";
import { IncidentsPage, MaintenancePage } from "./pages/Incidents";
import { PublicPage } from "./pages/Public";
import { Brand } from "./components/Brand";
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/monitoring", "Live monitoring", Activity],
  ["/digital-twin", "Digital twin", Box],
  ["/sensors", "IoT sensor network", Radio],
  ["/simulation", "Leak detection", TriangleAlert],
  ["/incidents", "Incident management", ClipboardList],
  ["/maintenance", "Maintenance", Wrench],
  ["/analytics", "Historical analytics", ChartNoAxesCombined],
  ["/map", "Infrastructure map", Map],
  ["/reports", "Reports", FileChartColumn],
  ["/settings", "Settings", Settings],
] as const;
export default function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [toast, setToast] = useState("");
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api("/health"),
  });
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  if (location.pathname.startsWith("/community")) return <PublicPage />;
  if (!checked)
    return (
      <div className="splash">
        <Droplets />
        Connecting to AquaTwin…
      </div>
    );
  if (!user)
    return (
      <Login
        demo={health.data?.demo}
        error={health.error?.message}
        onLogin={setUser}
      />
    );
  return (
    <Workspace
      user={user}
      signOut={() => logout().finally(() => setUser(null))}
      toast={toast}
      notify={setToast}
    />
  );
}
function Login({
  demo,
  error,
  onLogin,
}: {
  demo?: boolean;
  error?: string;
  onLogin: (u: User) => void;
}) {
  const [role, setRole] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="login-story">
        <div className="brand">
          <Brand />
        </div>
        <Badge>WATER OPERATIONS, CONNECTED</Badge>
        <h1>
          Every drop counts.
          <br />
          <em>
            Every incident
            <br />
            has an owner.
          </em>
        </h1>
        <p>
          A connected view of your water network.
          <br />
          From community report to verified repair.
        </p>
        <div className="login-grid" />
      </div>
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            onLogin(
              demo
                ? await loginDemo(role)
                : await loginFirebase(email, password),
            );
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="eyebrow">MUNICIPAL COMMAND CENTRE</span>
        <h2>Welcome to AquaTwin</h2>
        <p className="muted">Sign in to your water operations workspace.</p>
        {demo ? (
          <>
            <div className="notice">
              <Badge tone="amber">DEMO MODE</Badge>
              <p>
                Fictional municipal assets and simulated measurements. This
                local demonstration contains no live infrastructure.
              </p>
            </div>
            <Field label="Demo staff role">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="admin">Municipal Administrator</option>
                <option value="operator">Municipal Operator</option>
                <option value="technician">
                  Maintenance Technician · Team Alpha
                </option>
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </>
        )}
        {(message || error) && <p className="error">{message || error}</p>}
        <Button disabled={busy || demo === undefined} type="submit">
          {busy ? "Connecting…" : "Enter workspace"}
          <ArrowUpRight size={17} />
        </Button>
        <Link className="public-link" to="/community">
          Resident? Report or track a water incident →
        </Link>
      </form>
    </main>
  );
}
function Workspace({
  user,
  signOut,
  toast,
  notify,
}: {
  user: User;
  signOut: () => void;
  toast: string;
  notify: (s: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [simModal, setSimModal] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [zone, setZone] = useState("");
  const [ward, setWard] = useState("");
  const [sensor, setSensor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clock, setClock] = useState(new Date());
  const [pipeline, setPipeline] = useState("pipeline-a");
  const [severity, setSeverity] = useState("Moderate");
  const [busy, setBusy] = useState(false);
  const [simError, setSimError] = useState("");
  const query = new URLSearchParams({
    ...(zone ? { zone } : {}),
    ...(ward ? { ward } : {}),
    ...(sensor ? { sensor } : {}),
    ...(from ? { from: new Date(`${from}T00:00:00+02:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59+02:00`).toISOString() } : {}),
  }).toString();
  const result = useQuery({
    queryKey: ["workspace", query],
    queryFn: async () => {
      const [
        sensors,
        assets,
        incidents,
        analytics,
        simulations,
        tasks,
        notifications,
        settings,
      ] = await Promise.all([
        api(`/sensors?${query}`),
        api("/infrastructure"),
        api(`/incidents?${query}`),
        api(`/analytics/overview?${query}`),
        api("/simulations"),
        api("/maintenance/tasks"),
        api("/notifications"),
        api("/settings"),
      ]);
      return {
        sensors,
        assets,
        incidents,
        analytics,
        readings: analytics.readings,
        summary: analytics.summary,
        simulations,
        tasks,
        notifications,
        settings,
      };
    },
    refetchInterval: 15000,
  });
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    let socket: ReturnType<typeof io> | undefined;
    let active = true;
    getToken().then((token) => {
      if (!active) return;
      socket = io(base || window.location.origin, {
        auth: { token },
        reconnection: true,
      });
      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
      socket.on("connect_error", () => setConnected(false));
      let pending: ReturnType<typeof setTimeout> | undefined;
      for (const event of [
        "sensor:reading",
        "sensor:status",
        "incident:created",
        "incident:assigned",
        "incident:updated",
        "simulation:started",
        "simulation:stopped",
        "leak:suspected",
      ])
        socket.on(event, () => {
          if (!pending)
            pending = setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["workspace"] });
              pending = undefined;
            }, 250);
          if (event === "leak:suspected")
            notify("Suspected leak detected. Field verification required.");
        });
      socket.on("system:error", (data) => notify(data.message));
    });
    return () => {
      active = false;
      socket?.disconnect();
      clearInterval(interval);
    };
  }, []);
  async function perform(path: string, method: string, data?: unknown) {
    try {
      const response = await api(path, method, data);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      return response;
    } catch (e) {
      notify((e as Error).message);
      throw e;
    }
  }
  const location = useLocation();
  const title =
    navigation.find((n) => n[0] === location.pathname)?.[1] || "Overview";
  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <Brand />
        </Link>
        <div className="workspace-label">
          WORKSPACE <span>NW</span>
        </div>
        <nav>
          {navigation.map(([path, label, Icon], i) => (
            <NavLink
              end={path === "/"}
              key={path}
              to={path}
              title={label}
              onClick={() => {
                if (window.innerWidth < 800) setCollapsed(true);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {i === 5 && (result.data?.summary.openTickets ?? 0) > 0 && (
                <i>{result.data?.summary.openTickets}</i>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <span className="dot" />
            <div>
              {result.data?.settings.demo
                ? "Demo environment"
                : "Municipal environment"}
              <small>
                {result.data?.settings.demo
                  ? "Synthetic data · Isolated network"
                  : "Authorised operational access"}
              </small>
            </div>
          </div>
          <Link to="/community" className="resident-link">
            Community portal <ArrowUpRight size={15} />
          </Link>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft size={17} />
            <span>Collapse navigation</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle navigation"
          >
            <Menu size={19} />
          </button>
          <div className="municipality">
            {result.data?.settings.name || "AquaTwin"}
            <span>North West, South Africa</span>
          </div>
          <div className="topbar-right">
            <span className={`connection ${connected ? "" : "disconnected"}`}>
              <span className="dot" />
              {connected ? "System connected" : "Reconnecting"}
            </span>
            <span className="clock">
              {clock.toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Africa/Johannesburg",
              })}
              <small>
                {clock.toLocaleTimeString("en-ZA", {
                  timeZone: "Africa/Johannesburg",
                })}{" "}
                SAST
              </small>
            </span>
            <button
              className="notification-button"
              onClick={() => setNotifications(true)}
              aria-label="Notifications"
            >
              <Bell size={19} />
              {!!result.data?.notifications.length && <b />}
            </button>
            <div className="avatar">
              {user.role === "admin"
                ? "MA"
                : user.role === "operator"
                  ? "MO"
                  : "MT"}
            </div>
            <div className="user-label">
              {user.role === "admin"
                ? "Municipal Admin"
                : user.role === "operator"
                  ? "Municipal Operator"
                  : "Technician"}
              <small>{user.team || "Water Services"}</small>
            </div>
            <button
              className="icon-button"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="content">
          <div className="breadcrumb">
            Workspace <span>/</span> {title}
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">AQUATWIN OPERATIONS</div>
              <h1>{location.pathname === "/" ? "Network overview" : title}</h1>
              <p>Your water network. One connected view.</p>
            </div>
            <div className="heading-actions">
              {result.data?.settings.demo && (
                <Badge tone="amber">DEMO MODE</Badge>
              )}
              {user.role !== "technician" && result.data?.settings.demo && (
                <Button onClick={() => setSimModal(true)}>
                  <Play size={14} fill="currentColor" />
                  Simulate water leak
                </Button>
              )}
            </div>
          </div>
          <div className="filter-bar">
            <span className="filter-label">Filter network</span>
            <select aria-label="Municipality">
              <option>{result.data?.settings.name || "Municipality"}</option>
            </select>
            <select
              aria-label="Ward"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            >
              <option value="">All wards</option>
              {[1, 2, 3].map((i) => (
                <option key={i}>Ward {i}</option>
              ))}
            </select>
            <select
              aria-label="Zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              <option value="">All zones</option>
              {["Zone A", "Zone B", "Zone C"].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
            <select
              aria-label="Sensor"
              value={sensor}
              onChange={(e) => setSensor(e.target.value)}
            >
              <option value="">All sensors</option>
              {result.data?.sensors.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              aria-label="From date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span>—</span>
            <input
              aria-label="To date"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            {query && (
              <Button
                variant="ghost"
                onClick={() => {
                  setZone("");
                  setWard("");
                  setSensor("");
                  setFrom("");
                  setTo("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {result.isError && (
            <div className="error notice">
              {result.error.message}
              <Button variant="outline" onClick={() => result.refetch()}>
                Retry
              </Button>
            </div>
          )}
          {result.data ? (
            <DataContext.Provider
              value={{
                ...result.data,
                user,
                query,
                perform,
                notify,
                simulate: () => setSimModal(true),
              }}
            >
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/digital-twin" element={<TwinPage />} />
                <Route path="/sensors" element={<SensorsPage />} />
                <Route path="/simulation" element={<Simulations />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </DataContext.Provider>
          ) : (
            !result.isError && (
              <div className="empty">Loading municipal operations…</div>
            )
          )}
          <footer>
            AquaTwin <span>Smart Municipal Water Management</span>
            <span>
              {result.data?.settings.demo
                ? "Fictional infrastructure · Simulated measurements"
                : "Operational data · Access controlled"}{" "}
              · SAST (UTC+2)
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Bell size={17} />
          {toast}
          <button onClick={() => notify("")} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
      <Modal
        title="Simulate a water leak"
        open={simModal}
        onClose={() => setSimModal(false)}
      >
        <p className="muted">
          Generate an isolated synthetic anomaly. No commands are sent to
          physical infrastructure.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setSimError("");
            try {
              await perform("/simulations/start", "POST", {
                assetId: pipeline,
                severity,
              });
              setSimModal(false);
              notify(
                "Simulation started. Watching for abnormal flow and pressure.",
              );
            } catch (e) {
              setSimError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Demonstration pipeline">
            <select
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value)}
            >
              <option value="pipeline-a">Main supply pipeline · Zone A</option>
              <option value="pipeline-b">Distribution branch B · Zone B</option>
            </select>
          </Field>
          <Field label="Leak severity">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {["Minor", "Moderate", "Critical"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div className="notice">
            Alerts indicate a suspected leak and always require field
            verification.
          </div>
          {simError && <p className="error">{simError}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Starting…" : "Start simulation"}
          </Button>
        </form>
      </Modal>
      <Modal
        title="Notification centre"
        open={notifications}
        onClose={() => setNotifications(false)}
      >
        {result.data?.notifications.length ? (
          result.data.notifications.map((n: any) => (
            <Link
              key={n.id}
              className="notification-item"
              to="/incidents"
              onClick={() => setNotifications(false)}
            >
              <TriangleAlert size={18} />
              <div>
                {n.message}
                <small>{date(n.at)}</small>
              </div>
            </Link>
          ))
        ) : (
          <div className="empty">
            No alerts. The network is being monitored.
          </div>
        )}
      </Modal>
    </div>
  );
}
