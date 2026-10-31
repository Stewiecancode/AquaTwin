import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ComposedChart,
  BarChart,
  Bar,
} from "recharts";
import type { Reading } from "../../shared/domain";
export function TrendChart({
  readings,
  unit = "",
  baseline = false,
  color = "#0093d3",
}: {
  readings: Reading[];
  unit?: string;
  baseline?: boolean;
  color?: string;
}) {
  const data = readings.slice(-90).map((r) => ({
    ...r,
    time: new Date(r.timestamp).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    }),
  }));
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id={`gradient-${color.replace("#", "")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.24} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#213041"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            minTickGap={50}
            tick={{ fill: "#8596ab", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8596ab", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#142131",
              border: "1px solid #314156",
              borderRadius: 8,
            }}
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`]}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Measurement"
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${color.replace("#", "")})`}
            isAnimationActive={false}
          />
          {baseline && (
            <Line
              dataKey="baseline"
              name="Baseline"
              stroke="#8a99ab"
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Bars({
  data,
  x = "zone",
  y = "incidents",
}: {
  data: any[];
  x?: string;
  y?: string;
}) {
  return (
    <div className="chart short">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#213041" />
          <XAxis dataKey={x} tick={{ fill: "#8495a9", fontSize: 11 }} />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#8495a9", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#142131",
              border: "1px solid #314156",
            }}
          />
          <Bar dataKey={y} fill="#0093d3" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
