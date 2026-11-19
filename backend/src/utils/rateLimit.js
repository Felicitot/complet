// Limiteur de débit minimal en mémoire (suffisant pour une instance unique).
// Pour plusieurs instances, remplacer par un store partagé (Redis).
export function rateLimit({ windowMs, max, message = "Trop de requêtes, réessayez plus tard.", keyFn = (req) => req.ip }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ status: "error", message, retryAfter });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
    next();
  };
}
