import { Router } from "express";
import * as events from "../controllers/events";
import { validateBody } from "../middleware/validate";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { handleUploadErrors, singleImage } from "../middleware/upload";

const uploadEventPhoto = singleImage("image");

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
// Image upload, kept above /:id so it is not treated as an event id.
router.post(
  "/image",
  requireAuth,
  requireRole("ADMIN"),
  (req, res, next) =>
    uploadEventPhoto(req, res, (err) => {
      if (err) {
        try {
          handleUploadErrors(err);
        } catch (translated) {
          next(translated);
          return;
        }
      }
      next();
    }),
  events.uploadImage,
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
