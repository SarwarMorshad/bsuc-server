import { Router } from "express";
import authRoutes from "./auth";
import profileRoutes from "./profile";
import eventRoutes from "./events";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "bsuc-server",
    time: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/events", eventRoutes);

export default router;
