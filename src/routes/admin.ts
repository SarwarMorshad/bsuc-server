import { Router } from "express";
import * as admin from "../controllers/admin";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// The whole admin area is restricted to administrators.
router.use(requireAuth, requireRole("ADMIN"));

router.get("/stats", admin.stats);
router.get("/members", admin.listMembers);
router.patch("/members/:id/role", validateBody(admin.setRoleSchema), admin.setRole);

export default router;
