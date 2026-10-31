import { z } from "zod";
import type { WeatherContext } from "../shared/domain";

const responseSchema = z.object({
  current: z.object({
    time: z.string().min(1),
    temperature_2m: z.number().finite(),
    precipitation: z.number().finite().nonnegative(),
    weather_code: z.number().int().min(0).max(99),
  }),
});

export async function fetchWeatherContext(
  latitude: number,
  longitude: number,
): Promise<WeatherContext> {
  const params = new URLSearchParams({
    latitude: (Math.round(latitude * 10) / 10).toFixed(1),
    longitude: (Math.round(longitude * 10) / 10).toFixed(1),
    current: "temperature_2m,precipitation,weather_code",
    temperature_unit: "celsius",
    timezone: "auto",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok)
    throw new Error(`Weather lookup failed (HTTP ${response.status}).`);

  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("Weather provider returned an unsupported response.");

  return {
    source: "Open-Meteo",
    observedAt: parsed.data.current.time,
    temperatureC: parsed.data.current.temperature_2m,
    precipitationMm: parsed.data.current.precipitation,
    weatherCode: parsed.data.current.weather_code,
  };
}

export function describeWeatherCode(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Light snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] ?? `WMO code ${code}`;
}
