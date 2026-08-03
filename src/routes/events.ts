import { Router } from "express";
import * as events from "../controllers/events";
import { validateBody } from "../middleware/validate";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Public: published events only.
router.get("/", events.list);

// Admin: drafts included, plus create/edit/delete.
router.get("/all", requireAuth, requireRole("ADMIN"), events.listAll);
router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(events.createEventSchema),
  events.create,
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(events.updateEventSchema),
  events.update,
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), events.remove);

// Kept last so it does not shadow /all. optionalAuth lets an admin preview a
// draft, while anonymous visitors still get a 404 for unpublished events.
router.get("/:id", optionalAuth, events.getOne);

export default router;
