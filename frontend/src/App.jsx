import { useEffect } from "react";
import Header from "./components/Header.jsx";
import Sidebar, { MobileNav } from "./components/Sidebar.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ArchivesPage from "./pages/ArchivesPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import { useAppData } from "./context/AppDataContext.jsx";
import { useHashRoute } from "./hooks/useHashRoute.js";

export default function App() {
  const [route, navigate] = useHashRoute();
  const { loading, error, categories, selections, setSelection, reloadLight } = useAppData();

  // Retour en haut de page à chaque changement de page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const goToCategory = (id) => {
    navigate("/");
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  // Résultat de recherche : présélectionne modèle/run/type puis saute à la carte.
  const onPick = (r) => {
    if (r.patch) setSelection(r.category, { ...selections[r.category], ...r.patch });
    goToCategory(r.category);
  };

  let page;
  if (loading) page = <p className="text-sm text-inkmuted">Chargement des guidances…</p>;
  else if (!categories.length)
    page = (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-previsions/30 bg-previsions/10 p-6 text-sm text-previsions" role="alert">
        <p className="font-semibold">Impossible de contacter le serveur.</p>
        <p className="mt-1">{error || "Vérifiez que le backend tourne bien et que VITE_API_URL pointe dessus."}</p>
        <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-previsions px-4 py-2 text-white">
          Réessayer
        </button>
      </div>
    );
  else if (route === "/") page = <DashboardPage onCategory={goToCategory} />;
  else if (route === "/archives") page = <ArchivesPage />;
  else if (route === "/taches") page = <TasksPage />;
  else if (route === "/parametres") page = <SettingsPage />;
  else if (route === "/aide") page = <HelpPage />;
  else
    page = (
      <div className="mt-10 text-center text-sm text-inkmuted">
        Page introuvable. <a className="text-vent underline" href="#/">Retour au Dashboard</a>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <Header onPick={onPick} />
      <MobileNav route={route} />
      {error && categories.length > 0 && (
        <div className="bg-houles/10 px-6 py-2 text-center text-xs text-houles" role="alert">
          Connexion au serveur instable : les données affichées peuvent ne pas être à jour. ({error}){" "}
          <button className="underline" onClick={reloadLight}>
            Réessayer
          </button>
        </div>
      )}
      <div className="flex flex-1">
        <Sidebar route={route} onCategory={goToCategory} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{page}</main>
      </div>
    </div>
  );
}
