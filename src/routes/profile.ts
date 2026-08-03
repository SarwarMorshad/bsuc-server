import { Router } from "express";
import * as profile from "../controllers/profile";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

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
router.delete("/", validateBody(profile.deleteAccountSchema), profile.deleteAccount);

export default router;
