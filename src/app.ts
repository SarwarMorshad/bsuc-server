import express, { type Request, type Response } from "express";
import cors from "cors";

/**
 * Builds the Express application. Route modules will be mounted here as the
 * API grows (auth, members, events, admin).
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000" }));
  app.use(express.json());

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "bsuc-server", time: new Date().toISOString() });
  });

  // TODO: mount routers here
  // app.use("/api/auth", authRouter);
  // app.use("/api/events", eventsRouter);
  // app.use("/api/members", membersRouter);

  return app;
}
