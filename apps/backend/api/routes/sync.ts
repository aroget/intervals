import { Hono } from "hono";
import { runSync } from "../../data/sync/pipeline.js";
import { runDailyAnalysis } from "../../agents/daily.js";

const sync = new Hono();

/** POST /sync — trigger a full data sync then re-run today's analysis */
sync.post("/", async (c) => {
  try {
    await runSync();
    await runDailyAnalysis(undefined, undefined, undefined, undefined, false);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default sync;
