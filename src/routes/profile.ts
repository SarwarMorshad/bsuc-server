import { Router } from "express";
import * as profile from "../controllers/profile";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { handleUploadErrors, uploadImage } from "../middleware/upload";

const router = Router();

// Everything here acts on the signed-in member's own account.
router.use(requireAuth);

router.patch("/", validateBody(profile.updateProfileSchema), profile.updateProfile);
router.post(
  "/password",
  validateBody(profile.changePasswordSchema),
  profile.changePassword,
);
router.post("/email", validateBody(profile.changeEmailSchema), profile.changeEmail);

// Multer reports its own errors (file too large, wrong type), so they are
// translated into the API's standard error shape before reaching the handler.
router.post(
  "/avatar",
  (req, res, next) =>
    uploadImage(req, res, (err) => {
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
  profile.uploadAvatar,
);
router.delete("/avatar", profile.removeAvatar);
router.delete("/", validateBody(profile.deleteAccountSchema), profile.deleteAccount);

export default router;
