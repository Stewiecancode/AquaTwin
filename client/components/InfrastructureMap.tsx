import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMapEvents,
  Rectangle,
} from "react-leaflet";
import { Link } from "react-router-dom";
import type { Sensor, Asset, Incident } from "../../shared/domain";
import { date } from "./ui";
import "leaflet/dist/leaflet.css";
function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
const colors = {
  online: "#0093d3",
  offline: "#75869b",
  warning: "#f5b84b",
  critical: "#f06c78",
};
export default function InfrastructureMap({
  sensors = [],
  assets = [],
  incidents = [],
  onPick,
  position,
}: {
  sensors?: Sensor[];
  assets?: Asset[];
  incidents?: Incident[];
  onPick?: (lat: number, lng: number) => void;
  position?: { lat: number; lng: number };
}) {
  return (
    <div className="map-shell">
      <MapContainer
        center={position ? [position.lat, position.lng] : [-25.844, 25.65]}
        zoom={13}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {assets.length > 0 && (
          <Rectangle
            bounds={[
              [-25.866, 25.622],
              [-25.819, 25.68],
            ]}
            pathOptions={{
              color: "#0093d3",
              weight: 1,
              dashArray: "5 8",
              fillOpacity: 0.025,
            }}
          />
        )}
        {assets.map((a) =>
          a.path ? (
            <Polyline
              key={a.id}
              positions={a.path}
              pathOptions={{
                color: incidents.some(
                  (i) =>
                    i.assetId === a.id &&
                    !["Resolved", "Verified", "Closed"].includes(i.status),
                )
                  ? "#f06c78"
                  : "#0093d3",
                weight: 4,
              }}
            >
              <Popup>
                {a.name}
                <br />
                Fictional demonstration pipeline
              </Popup>
            </Polyline>
          ) : (
            <CircleMarker
              key={a.id}
              center={a.gps}
              radius={11}
              pathOptions={{
                color: a.type === "reservoir" ? "#6ca8fa" : "#b591f6",
                fillOpacity: 0.4,
              }}
            >
              <Popup>
                {a.name} · fictional {a.type}
              </Popup>
            </CircleMarker>
          ),
        )}
        {sensors.map((s) => (
          <CircleMarker
            key={s.id}
            center={s.gps}
            radius={6}
            pathOptions={{
              color: colors[s.status],
              fillColor: colors[s.status],
              fillOpacity: 1,
            }}
          >
            <Popup>
              <b>{s.name}</b>
              <br />
              {s.id}
              <br />
              {s.type}: {s.reading.toFixed(2)} {s.unit}
              <br />
              {s.status} · {s.source}
              <br />
              {date(s.updatedAt)}
              <br />
              Asset: {s.assetId}
              <br />
              <Link to={`/sensors?sensor=${s.id}`}>Sensor history</Link> ·{" "}
              <Link to={`/digital-twin?sensor=${s.id}`}>Digital twin</Link>
            </Popup>
          </CircleMarker>
        ))}
        {incidents
          .filter((i) => !["Verified", "Closed"].includes(i.status))
          .map((i) => (
            <CircleMarker
              key={i.id}
              center={i.gps}
              radius={10}
              pathOptions={{ color: "#f5b84b", weight: 2, fillOpacity: 0.25 }}
            >
              <Popup>
                {i.reference}
                <br />
                {i.status}
                <br />
                <Link to="/incidents">Review incident</Link>
              </Popup>
            </CircleMarker>
          ))}
        {onPick && <Picker onPick={onPick} />}{" "}
        {position && (
          <CircleMarker
            center={position}
            radius={8}
            pathOptions={{ color: "#26d6c5", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
      <div className="map-caption">
        {onPick
          ? "Click the map to set the report location"
          : "SYNTHETIC NETWORK · Fictional asset locations"}
      </div>
    </div>
  );
}
