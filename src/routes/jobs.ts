import { Router } from "express";
import * as jobs from "../controllers/jobs";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { honeypot, rateLimit } from "../middleware/rate-limit";

const router = Router();

/**
 * Public: anyone may submit a listing, but it lands as PENDING and is not
 * readable by anyone until an admin approves it.
 */
router.post(
  "/submit",
  honeypot("website2"),
  // Validation runs first on purpose, so a company correcting typos in the
  // form is never locked out — only submissions good enough to be stored
  // count against the limit.
  validateBody(jobs.submitJobSchema),
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Zu viele Einsendungen. Bitte versuchen Sie es später erneut.",
  }),
  jobs.submit,
);

// Members only: the listings are for our community, not the open web.
router.get("/", requireAuth, jobs.list);

// Admin: every listing including submitter details, plus moderation.
router.get("/all", requireAuth, requireRole("ADMIN"), jobs.listAll);
// Full record including the advert bodies, for the details modal.
router.get("/:id", requireAuth, requireRole("ADMIN"), jobs.getOne);
router.patch(
  "/:id/review",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(jobs.reviewJobSchema),
  jobs.review,
);
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validateBody(jobs.updateJobSchema),
  jobs.update,
);
router.delete("/:id", requireAuth, requireRole("ADMIN"), jobs.remove);

export default router;
