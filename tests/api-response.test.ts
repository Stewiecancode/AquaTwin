import { test } from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../client/api-response";

test("reads API data", async () => {
  assert.deepEqual(
    await readApiResponse(Response.json({ data: { ok: true } })),
    { ok: true },
  );
});
test("preserves API error messages", async () => {
  await assert.rejects(
    readApiResponse(
      Response.json({ error: "Authentication required" }, { status: 401 }),
    ),
    /Authentication required/,
  );
});
test("explains empty proxy failures", async () => {
  await assert.rejects(
    readApiResponse(new Response("", { status: 500 })),
    /HTTP 500.*API server/,
  );
});
test("handles non-JSON proxy errors", async () => {
  await assert.rejects(
    readApiResponse(new Response("<h1>Bad gateway</h1>", { status: 502 })),
    /HTTP 502/,
  );
});
test("rejects invalid success payloads", async () => {
  for (const body of ["", "{", "null", "{}", "<html></html>"])
    await assert.rejects(
      readApiResponse(new Response(body)),
      /empty or invalid response/,
    );
});
test("accepts no-content responses", async () => {
  assert.equal(
    await readApiResponse(new Response(null, { status: 204 })),
    undefined,
  );
});
