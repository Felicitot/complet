// Exemple de script de prévision lancé depuis « Scripts & Tâches ».
// Remplacez son contenu par votre vrai calcul (ou ajoutez un script .py / .sh
// dans ce même dossier). Variables fournies par Rivotra :
//   RIVOTRA_DATA_DIR  dossier de données du serveur
//   RIVOTRA_DATE      date du jour (UTC, AAAA-MM-JJ)
// Ce que le script écrit sur la sortie standard apparaît dans les journaux.
// Un code de sortie différent de 0 marque la tâche en échec.
console.log(`[exemple_orages] démarrage pour le ${process.env.RIVOTRA_DATE}`);
console.log(`[exemple_orages] arguments : ${process.argv.slice(2).join(" ") || "(aucun)"}`);
console.log("[exemple_orages] terminé sans erreur.");
