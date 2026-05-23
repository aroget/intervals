import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./api/index.js";

const port = Number(process.env.PORT ?? 7000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Intervals agent API running on http://localhost:${port}`);
});
