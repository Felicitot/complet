import { Router } from "express";
import { adminConfigured, checkPassword, issueToken, requireAdmin } from "../services/auth.js";
import { HttpError, ah } from "../utils/http.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 60000,
  max: Number(process.env.LOGIN_MAX_PER_MINUTE ?? 10),
  message: "Trop de tentatives de connexion, réessayez dans une minute.",
});

router.post("/login", loginLimiter, ah(async (req, res) => {
  if (!adminConfigured()) throw new HttpError(503, "Accès administrateur désactivé : définissez ADMIN_PASSWORD.");
  if (!checkPassword(req.body?.password)) throw new HttpError(401, "Mot de passe incorrect.");
  res.json(issueToken());
}));

router.get("/me", requireAdmin, (req, res) => res.json({ role: "admin" }));

export default router;
