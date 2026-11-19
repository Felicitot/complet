import { Wind, CloudRain, Waves, Thermometer, Satellite, AlertTriangle } from "lucide-react";

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-5 shadow-sm">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-inkmuted">{children}</div>
    </section>
  );
}

const TERMS = [
  ["Run", "Un lancement du modèle de prévision. Il y en a quatre par jour : Run00, Run06, Run12 et Run18 (heure UTC de départ de la prévision)."],
  ["Échéance", "Le délai entre le départ du run et l'instant prévu. « +48h » signifie une prévision à 48 heures, soit J+2."],
  ["Valable le", "La date et l'heure (UTC, « Z ») auxquelles la carte est censée être vraie : heure du run + échéance."],
  ["Modèle", "Le système numérique qui calcule la prévision (GFS, IFS, ICON, UKMO, AROME, WW3, WAM…). Comparer plusieurs modèles aide à juger la fiabilité."],
  ["Probabiliste", "Produit issu de plusieurs simulations : il indique la probabilité de dépasser un seuil (par exemple une houle supérieure à 2 m ou 4 m, une anomalie de température de +2 °C ou +4 °C)."],
  ["CPRAT", "Précipitations convectives : les pluies liées aux orages et aux nuages à fort développement vertical."],
];

const SHORTCUTS = [
  ["Ctrl + K  ou  /", "Placer le curseur dans la recherche"],
  ["← / →", "Échéance précédente / suivante (visionneuse)"],
  ["Espace", "Lancer ou arrêter l'animation (visionneuse)"],
  ["+ / − / 0", "Zoom avant / arrière / réinitialiser (visionneuse)"],
  ["Échap", "Fermer la visionneuse"],
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Aide et guide utilisateur</h1>
        <p className="text-sm text-inkmuted">Tout ce qu'il faut pour lire les guidances et utiliser le portail.</p>
      </div>

      <Section title="À quoi sert ce portail ?">
        <p>Il rassemble en un seul endroit les cartes de guidance de prévision pour Madagascar : vent, pluies, houles, températures, images satellites et prévisions spécifiques. Chaque carte est une image PNG que vous pouvez agrandir, comparer et télécharger.</p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs">
          {[[Wind, "Vent", "text-vent"], [CloudRain, "Pluies", "text-pluies"], [Waves, "Houles", "text-houles"], [Thermometer, "Températures", "text-temperatures"], [Satellite, "Satellites", "text-satellites"], [AlertTriangle, "Prévisions spécifiques", "text-previsions"]].map(([Icon, label, color]) => (
            <span key={label} className={`inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 font-medium ${color}`}>
              <Icon size={14} /> {label}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Choisir une carte">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Dans la carte de la catégorie voulue, choisissez le <strong>run</strong>, puis le <strong>modèle</strong> (et le <strong>type</strong> pour les pluies).</li>
          <li>Choisissez l'<strong>échéance</strong> avec les onglets +24h à +120h.</li>
          <li>Sous l'image, vérifiez la ligne « <em>Run… du … · valable le …</em> » : c'est l'instant exact représenté.</li>
          <li>Cliquez sur l'image (ou « Agrandir ») pour la visionneuse plein écran.</li>
        </ol>
        <p>Vos choix sont mémorisés sur ce navigateur : vous retrouvez la même sélection à la prochaine visite.</p>
      </Section>

      <Section title="Visionneuse, animation et comparaison">
        <p><strong>Visionneuse :</strong> zoom à la molette, déplacement en glissant l'image, double-clic pour zoomer. Le bouton lecture (ou la barre d'espace) fait défiler les échéances J+1 à J+5 comme une animation.</p>
        <p><strong>Comparer :</strong> le bouton « Comparer » affiche deux cartes côte à côte, au choix <em>deux modèles</em> pour le même run, ou <em>deux runs</em> pour le même modèle. Utile pour voir si la prévision est stable d'un run à l'autre.</p>
        <p><strong>ZIP :</strong> télécharge d'un coup toutes les échéances du run affiché.</p>
        <table className="mt-2 w-full max-w-md text-left text-xs">
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <td className="py-1.5 pr-4 font-mono text-ink">{k}</td>
                <td className="py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Archives">
        <p>La page Archives permet de retrouver les guidances des jours précédents (14 jours par défaut, réglable par l'administrateur). Choisissez la catégorie, la date du run, le run et le modèle : les cinq échéances s'affichent côte à côte.</p>
      </Section>

      <Section title="Statuts et actualisation">
        <p>Le point coloré à côté du nom d'une catégorie indique son état : <span className="text-pluies">vert</span> disponible, <span className="text-houles">orange</span> mise à jour en cours, <span className="text-previsions">rouge</span> erreur, gris non disponible.</p>
        <p>Le portail s'actualise automatiquement (la prochaine échéance est indiquée dans le bandeau de statut). Le bouton « Actualiser » force une mise à jour immédiate. La cloche liste les derniers évènements (fin d'actualisation, échec d'un script…).</p>
        <p>Le badge <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Données simulées</span> signale que la catégorie affiche des images d'exemple, pas de vraies prévisions. Il devient « Fichiers réels » quand l'administrateur branche vos scripts.</p>
      </Section>

      <Section title="Glossaire">
        <dl className="space-y-2">
          {TERMS.map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium text-ink">{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Pour l'administrateur">
        <p><strong>Paramètres</strong> : indiquez où vos scripts déposent les PNG (par exemple <code className="rounded bg-canvas px-1">/data/guidances/{"{category}"}/{"{date}"}/{"{run}"}/{"{model}"}/J{"{day}"}.png</code>), testez le chemin, puis passez la catégorie en « Fichiers réels ». Réglez aussi la fréquence d'actualisation et la durée des archives.</p>
        <p><strong>Scripts &amp; Tâches</strong> : placez un script (.js, .py ou .sh) dans le dossier des scripts du serveur, créez la tâche, choisissez son intervalle et suivez son historique et ses journaux. Un échec passe la catégorie concernée en rouge et envoie une notification.</p>
      </Section>
    </div>
  );
}
