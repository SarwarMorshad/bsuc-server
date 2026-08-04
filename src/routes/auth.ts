import { Router } from "express";
import * as auth from "../controllers/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth, optionalAuth } from "../middleware/auth";

const router = Router();

router.post("/register", validateBody(auth.registerSchema), auth.register);
router.post("/login", validateBody(auth.loginSchema), auth.login);
router.post("/verify", validateBody(auth.verifySchema), auth.verifyEmail);
router.post(
  "/resend-verification",
  validateBody(auth.resendSchema),
  auth.resendVerification,
);
router.post("/logout", optionalAuth, auth.logout);
router.get("/me", requireAuth, auth.me);

export default router;
