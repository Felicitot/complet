import { useAppData } from "../context/AppDataContext.jsx";
import StatusPanel from "../components/StatusPanel.jsx";
import SummaryRow from "../components/SummaryRow.jsx";
import { ForecastCard, SatellitesCard, SpecificItemsCard } from "../components/GuidanceCards.jsx";

export default function DashboardPage({ onCategory }) {
  const { categories, refreshError, clearRefreshError } = useAppData();

  return (
    <div className="space-y-6">
      {refreshError && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-previsions/30 bg-previsions/10 px-4 py-3 text-sm text-previsions" role="alert">
          <span>{refreshError}</span>
          <button onClick={clearRefreshError} className="text-xs underline">
            Fermer
          </button>
        </div>
      )}
      <StatusPanel />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {categories.map((c) => {
          if (c.kind === "model_run" || c.kind === "type_model_run") return <ForecastCard key={c.id} category={c} />;
          if (c.kind === "items") return <SpecificItemsCard key={c.id} category={c} />;
          if (c.kind === "gallery") return <SatellitesCard key={c.id} category={c} />;
          return null;
        })}
      </div>
      <SummaryRow onCategory={onCategory} />
    </div>
  );
}
