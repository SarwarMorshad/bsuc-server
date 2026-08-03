import { Router } from "express";
import authRoutes from "./auth";
import profileRoutes from "./profile";

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

export default router;
