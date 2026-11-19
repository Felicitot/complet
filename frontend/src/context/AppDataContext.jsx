import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCategories,
  fetchStatus,
  fetchSchedule,
  fetchSources,
  fetchEvents,
  triggerRefresh,
} from "../api/guidanceApi.js";
import { useStoredState } from "../hooks/useStoredState.js";

const AppDataContext = createContext(null);
const POLL_MS = 60000;

export function defaultSelectionFor(category) {
  if (category.kind === "model_run") return { run: category.runs[0], model: category.models[0], day: 1 };
  if (category.kind === "type_model_run") {
    return { type: category.types[0], run: category.runs[0], model: category.models[0], day: 1 };
  }
  if (category.kind === "items") return { item: category.items[0].id };
  return {};
}

// Ne garde des sélections mémorisées que les valeurs encore valides.
function sanitizeSelection(category, stored) {
  const base = defaultSelectionFor(category);
  if (!stored || typeof stored !== "object") return base;
  const out = { ...base };
  if (category.runs?.includes(stored.run)) out.run = stored.run;
  if (category.models?.includes(stored.model)) out.model = stored.model;
  if (category.types?.includes(stored.type)) out.type = stored.type;
  if (Number.isInteger(stored.day) && stored.day >= 1 && stored.day <= (category.maxDay || 1)) out.day = stored.day;
  return out;
}

export function AppDataProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [sources, setSources] = useState({});
  const [schedule, setSchedule] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [storedSelections, setStoredSelections] = useStoredState("rivotra.selections.v1", {});
  // Sélections effectives : valeurs mémorisées validées contre le registre.
  const selections = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, sanitizeSelection(c, storedSelections[c.id])])),
    [categories, storedSelections]
  );

  const setSelection = useCallback(
    (categoryId, next) => setStoredSelections((prev) => ({ ...prev, [categoryId]: next })),
    [setStoredSelections]
  );

  // Données qui changent en cours de journée (statut, planning, évènements, sources).
  const reloadLight = useCallback(async () => {
    try {
      const [st, sch, ev, src] = await Promise.all([fetchStatus(), fetchSchedule(), fetchEvents(15), fetchSources()]);
      setStatus(st);
      setSchedule(sch);
      setEvents(ev.events);
      setSources(src.sources);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setCategories(await fetchCategories());
        await reloadLight();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
    const id = setInterval(reloadLight, POLL_MS);
    return () => clearInterval(id);
  }, [reloadLight]);

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      await triggerRefresh();
      await reloadLight();
    } catch (err) {
      setRefreshError(err.status === 429 ? `Actualisation trop fréquente : réessayez dans ${err.retryAfter || "quelques"} s.` : err.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [reloadLight]);

  const value = useMemo(
    () => ({
      categories,
      status,
      epoch: status?.epoch,
      sources,
      schedule,
      events,
      loading,
      error,
      isRefreshing,
      refreshError,
      clearRefreshError: () => setRefreshError(null),
      selections,
      setSelection,
      doRefresh,
      reloadLight,
    }),
    [categories, status, sources, schedule, events, loading, error, isRefreshing, refreshError, selections, setSelection, doRefresh, reloadLight]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useAppData = () => useContext(AppDataContext);
