import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

// Affiche le formulaire de connexion tant que l'utilisateur n'est pas admin.
export default function RequireAdmin({ title, children }) {
  const { isAdmin, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isAdmin) return children;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-paper p-6 shadow-sm">
      <div className="flex items-center gap-2 text-navy">
        <Lock size={18} />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <p className="mt-1 text-sm text-inkmuted">Cette page est réservée à l'administrateur.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-inkmuted">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="rounded-lg bg-previsions/10 px-3 py-2 text-sm text-previsions">{error}</p>}
        <button disabled={busy || !password} className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy2 disabled:opacity-50">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
