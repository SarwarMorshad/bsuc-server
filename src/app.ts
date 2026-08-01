import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFound } from "./middleware/error";

/** Builds the Express application with middleware, routes and error handling. */
export function createApp() {
  const app = express();

  // credentials: the session cookie must be sent on cross-origin requests
  // from the Next.js client.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
