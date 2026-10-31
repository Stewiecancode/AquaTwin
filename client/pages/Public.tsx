import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Droplets,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  Search,
  Copy,
  CloudSun,
} from "lucide-react";
import { api } from "../api";
import { Button, Badge, Field, date } from "../components/ui";
import InfrastructureMap from "../components/InfrastructureMap";
import { readPhoto } from "./Incidents";
import { Brand } from "../components/Brand";
import { describeWeatherCode, fetchWeatherContext } from "../weather";
import type { WeatherContext } from "../../shared/domain";
export function PublicPage() {
  const [tab, setTab] = useState("report");
  const [gps, setGps] = useState({ lat: -25.85, lng: 25.65 });
  const [pinned, setPinned] = useState(false);
  const [weatherContext, setWeatherContext] =
    useState<WeatherContext | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [photo, setPhoto] = useState<{
    name: string;
    data: string;
    stage: "report";
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    reference: string;
    trackingKey: string;
  } | null>(null);
  const [tracking, setTracking] = useState<any>(null);
  const selectLocation = (position: { lat: number; lng: number }) => {
    setGps(position);
    setPinned(true);
    setWeatherContext(null);
    setWeatherError("");
  };
  return (
    <div className="public-page">
      <header>
        <Link to="/" className="brand">
          <Brand />
        </Link>
        <Link className="text-link" to="/">
          Municipal staff sign in →
        </Link>
      </header>
      <main>
        <Badge>COMMUNITY PORTAL</Badge>
        <h1>
          Better water services
          <br />
          start with your report.
        </h1>
        <p className="muted">
          Report a problem. Keep your reference. Follow the repair.
        </p>
        <div className="tabs">
          <button
            className={tab === "report" ? "active" : ""}
            onClick={() => {
              setTab("report");
              setError("");
            }}
          >
            Report an incident
          </button>
          <button
            className={tab === "track" ? "active" : ""}
            onClick={() => {
              setTab("track");
              setError("");
            }}
          >
            Track your report
          </button>
        </div>
        {tab === "report" ? (
          receipt ? (
            <section className="panel receipt">
              <CheckCircle2 size={40} />
              <h2>Your report has been received.</h2>
              <p>
                Save both values below. Your private tracking key is shown only
                once.
              </p>
              <Field label="Incident reference">
                <input readOnly value={receipt.reference} />
              </Field>
              <Field label="Private tracking key">
                <input readOnly value={receipt.trackingKey} />
              </Field>
              <Button
                onClick={() =>
                  navigator.clipboard
                    .writeText(
                      `Reference: ${receipt.reference}\nTracking key: ${receipt.trackingKey}`,
                    )
                    .catch(() =>
                      setError(
                        "Copy was unavailable. Please save these values manually.",
                      ),
                    )
                }
              >
                <Copy size={15} />
                Copy tracking details
              </Button>
              <p className="fine-print">
                The municipality will review and validate your report before
                assigning repair work.
              </p>
            </section>
          ) : (
            <form
              className="panel public-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                if (!pinned) {
                  setError(
                    "Please select a location on the map or use your GPS.",
                  );
                  return;
                }
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  setReceipt(
                    await api("/incidents", "POST", {
                      description: f.get("description"),
                      location: f.get("location"),
                      gps,
                      category: f.get("category"),
                      contact: f.get("contact"),
                      consent: f.get("consent") === "on",
                      evidence: photo ? [photo] : [],
                      ...(weatherContext ? { weatherContext } : {}),
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="section-heading">
                <h2>Tell us what happened</h2>
                <Badge tone="gray">No account needed</Badge>
              </div>
              <Field label="Problem category">
                <select name="category">
                  {[
                    "Water leak",
                    "No water",
                    "Low pressure",
                    "Water quality",
                    "Other",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location or nearest landmark">
                <input
                  name="location"
                  minLength={3}
                  maxLength={200}
                  required
                  placeholder="Street, suburb, or nearby landmark"
                />
              </Field>
              <div className="location-header">
                <span className="muted">Pin the location of the incident</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setError("GPS is not supported. Select a map location.");
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (p) =>
                        selectLocation({
                          lat: p.coords.latitude,
                          lng: p.coords.longitude,
                        }),
                      () =>
                        setError(
                          "GPS permission unavailable. Select a location on the map instead.",
                        ),
                    );
                  }}
                >
                  <MapPin size={15} />
                  Use my GPS
                </Button>
              </div>
              <InfrastructureMap
                key={pinned ? "selected" : "initial"}
                onPick={(lat, lng) => {
                  selectLocation({ lat, lng });
                }}
                position={gps}
              />
              <p className="fine-print">
                {pinned
                  ? `Selected: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}`
                  : "No location selected. Click the map to place a pin."}
              </p>
              <div className="weather-lookup">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!pinned || weatherBusy}
                  onClick={async () => {
                    setWeatherBusy(true);
                    setWeatherError("");
                    setWeatherContext(null);
                    try {
                      setWeatherContext(
                        await fetchWeatherContext(gps.lat, gps.lng),
                      );
                    } catch (e) {
                      setWeatherError(
                        e instanceof Error
                          ? e.message
                          : "Weather lookup failed.",
                      );
                    } finally {
                      setWeatherBusy(false);
                    }
                  }}
                >
                  <CloudSun size={15} />
                  {weatherBusy ? "Checking weather…" : "Check local weather"}
                </Button>
                <p className="fine-print">
                  Optional context from{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo
                  </a>
                  . The selected pin is rounded to about 11 km before lookup;
                  weather is not a sensor reading.
                </p>
                {weatherContext && (
                  <p className="weather-result" role="status">
                    {describeWeatherCode(weatherContext.weatherCode)} ·{" "}
                    {weatherContext.temperatureC} °C ·{" "}
                    {weatherContext.precipitationMm} mm precipitation ·{" "}
                    {weatherContext.observedAt.replace("T", " ")}
                  </p>
                )}
                {weatherError && (
                  <p className="error" role="alert">
                    {weatherError}
                  </p>
                )}
              </div>
              <Field label="Describe the problem">
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="What can you see? How long has it been happening?"
                />
              </Field>
              <Field label="Photograph (optional · JPEG, PNG, WebP · max 1 MB)">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      try {
                        setPhoto({
                          name: file.name,
                          data: await readPhoto(file),
                          stage: "report",
                        });
                      } catch (e) {
                        setError((e as Error).message);
                      }
                  }}
                />
              </Field>
              {photo && (
                <div className="evidence">
                  <img src={photo.data} alt="Report evidence preview" />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPhoto(null)}
                  >
                    Remove photo
                  </Button>
                </div>
              )}
              <Field label="Contact email or phone (optional)">
                <input
                  name="contact"
                  maxLength={150}
                  placeholder="Leave blank to report anonymously"
                />
              </Field>
              <label className="checkbox">
                <input type="checkbox" name="consent" />I consent to the
                municipality using my contact details to follow up on this
                report.
              </label>
              <p className="fine-print">
                Contact details and photos are never shown on the public
                tracking page. Do not include identity documents or sensitive
                personal information.
              </p>
              <Button disabled={busy}>
                {busy ? "Submitting report…" : "Submit water incident"}
              </Button>
            </form>
          )
        ) : (
          <section className="panel public-form">
            <h2>Follow your incident</h2>
            <p className="muted">
              Use the reference and private tracking key issued when you
              submitted your report.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                setTracking(null);
                const f = new FormData(e.currentTarget);
                try {
                  setTracking(
                    await api("/public/track", "POST", {
                      reference: f.get("reference"),
                      trackingKey: f.get("trackingKey"),
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Incident reference">
                <input
                  required
                  name="reference"
                  defaultValue={receipt?.reference}
                  placeholder="AQ-2026-…"
                />
              </Field>
              <Field label="Private tracking key">
                <input
                  required
                  name="trackingKey"
                  defaultValue={receipt?.trackingKey}
                />
              </Field>
              <Button disabled={busy}>
                <Search size={16} />
                {busy ? "Checking…" : "Track incident"}
              </Button>
            </form>
            {tracking && (
              <div className="tracking-result">
                <h3>{tracking.reference}</h3>
                <Badge>{tracking.status}</Badge>
                <div className="timeline">
                  {tracking.history.map((h: any, index: number) => (
                    <div key={index}>
                      <span className="dot" />
                      <div>
                        <b>{h.status}</b>
                        <small>{date(h.at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>AquaTwin · Community water incident reporting</footer>
      </main>
    </div>
  );
}
