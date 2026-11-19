import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { login as apiLogin } from "../api/adminApi.js";

const AuthContext = createContext(null);
const KEY = "rivotra.admin.token";

function readToken() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    return Date.parse(expiresAt) > Date.now() ? token : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);

  const login = useCallback(async (password) => {
    const res = await apiLogin(password);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(res));
    } catch {
      /* ignoré */
    }
    setToken(res.token);
  }, []);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignoré */
    }
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, isAdmin: Boolean(token), login, logout }), [token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
