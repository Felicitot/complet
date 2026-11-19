#!/bin/sh
# Script d'exemple qui échoue volontairement : permet de voir comment un
# échec apparaît dans l'historique, les notifications et le statut système.
echo "Calcul en cours..."
echo "Fichier d'entrée introuvable" >&2
exit 3
