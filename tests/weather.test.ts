import { test } from "node:test";
import assert from "node:assert/strict";
import { describeWeatherCode, fetchWeatherContext } from "../client/weather";

test("weather lookup rounds coordinates and returns validated current conditions", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl: URL | undefined;
  try {
    globalThis.fetch = async (input) => {
      requestUrl = new URL(String(input));
      return Response.json({
        current: {
          time: "2026-10-31T17:00",
          temperature_2m: 22.4,
          precipitation: 0,
          weather_code: 2,
        },
      });
    };

    assert.deepEqual(await fetchWeatherContext(-25.85, 25.65), {
      source: "Open-Meteo",
      observedAt: "2026-10-31T17:00",
      temperatureC: 22.4,
      precipitationMm: 0,
      weatherCode: 2,
    });
    assert.equal(requestUrl?.searchParams.get("latitude"), "-25.8");
    assert.equal(requestUrl?.searchParams.get("longitude"), "25.7");
    assert.equal(
      requestUrl?.searchParams.get("current"),
      "temperature_2m,precipitation,weather_code",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("weather lookup reports HTTP and malformed provider responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(
      fetchWeatherContext(0, 0),
      /Weather lookup failed \(HTTP 503\)/,
    );

    globalThis.fetch = async () => Response.json({ current: {} });
    await assert.rejects(
      fetchWeatherContext(0, 0),
      /Weather provider returned an unsupported response/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("weather descriptions match WMO codes without grouping unsupported values", () => {
  assert.equal(describeWeatherCode(1), "Mainly clear");
  assert.equal(describeWeatherCode(95), "Thunderstorm");
  assert.equal(describeWeatherCode(4), "WMO code 4");
});
