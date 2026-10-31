import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  twinStateSchema,
  twinEventSchema,
  twinCommandSchema,
} from "../shared/twin.js";

// Mounted behind the application's existing staff authentication middleware.
// Never starts the controller: the user runs node controller.js manually.
export function createTwinRouter(
  allowCommands: RequestHandler,
  controllerUrl = process.env.TWIN_CONTROLLER_URL || "http://127.0.0.1:8765",
) {
  const router = Router();
  async function request(path: string, body?: unknown) {
    let response: Response;
    try {
      response = await fetch(
        `${controllerUrl.replace(/\/$/, "")}/api/${path}`,
        {
          method: body === undefined ? "GET" : "POST",
          headers: { "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(1500),
        },
      );
    } catch {
      throw Object.assign(
        new Error(
          "Township controller offline. Run node controller.js on the controller computer.",
        ),
        { status: 503 },
      );
    }
    if (!response.ok)
      throw Object.assign(
        new Error("The township controller could not complete the request."),
        { status: 502 },
      );
    return response.json();
  }
  router.get("/", async (_req, res) => {
    const [state, events] = await Promise.all([
      request("state"),
      request("events"),
    ]);
    const snapshot = {
      state: twinStateSchema.parse(state),
      events: z.array(twinEventSchema).parse(events),
    };
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: snapshot });
  });
  router.post("/leak", allowCommands, async (req, res) => {
    const command = twinCommandSchema.parse(req.body);
    const state = twinStateSchema.parse(await request("leak", command));
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: state });
  });
  return router;
}
