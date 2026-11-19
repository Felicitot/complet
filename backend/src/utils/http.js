// Erreur HTTP applicative : le gestionnaire d'erreurs d'Express la convertit
// en réponse JSON avec le bon code de statut.
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Enveloppe les routes async (Express 4 n'attrape pas les rejets de promesse).
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
