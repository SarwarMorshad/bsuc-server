import { Router } from "express";
import * as auth from "../controllers/auth";
import { validateBody } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", validateBody(auth.registerSchema), auth.register);
router.post("/login", validateBody(auth.loginSchema), auth.login);
router.post("/logout", auth.logout);
router.get("/me", requireAuth, auth.me);

export default router;
