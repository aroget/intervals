import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

import chatRoutes from "./routes/chat.js";
import analysisRoutes from "./routes/analysis.js";
import athleteRoutes from "./routes/athlete.js";
import syncRoutes from "./routes/sync.js";
import workoutRoutes from "./routes/workout.js";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: process.env.FRONT_END_URL?.split(","),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/chat", chatRoutes);
app.route("/analysis", analysisRoutes);
app.route("/athlete", athleteRoutes);
app.route("/sync", syncRoutes);
app.route("/workout", workoutRoutes);

app.onError((err, c) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return c.json({ error: message }, 500);
});

// 2. EXPORT THE METHOD HANDLERS FOR VERCEL
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);

// Keep this at the bottom so your existing setup doesn't break elsewhere
export default app;
