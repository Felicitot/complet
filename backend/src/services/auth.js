// Authentification administrateur par mot de passe unique (variable
// ADMIN_PASSWORD) et jeton signé (HMAC-SHA256) valable 12 h.
// Suffisant pour un portail interne ; pour plusieurs comptes ou un SSO,
// remplacer ce module (l'interface requireAdmin() reste la même).
import crypto from "crypto";
import { HttpError } from "../utils/http.js";

const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString("hex");
const TTL_MS = 12 * 3600 * 1000;

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (payload) => crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken() {
  const exp = Date.now() + TTL_MS;
  const payload = b64(JSON.stringify({ exp, role: "admin" }));
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp).toISOString() };
}

export function verifyToken(token) {
  if (typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req, res, next) {
  if (!adminConfigured()) return next(new HttpError(503, "Accès administrateur désactivé : définissez ADMIN_PASSWORD."));
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyToken(token)) return next(new HttpError(401, "Authentification administrateur requise."));
  next();
}
