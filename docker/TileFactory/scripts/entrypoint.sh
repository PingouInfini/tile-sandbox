#!/bin/bash
set -e

COMMAND=$1

# Si aucune commande n'est passée, on affiche l'aide
if [ -z "$COMMAND" ]; then
    echo "Usage: docker run tilefactory [raster|vector|daemon|bash] ..."
    exit 1
fi

shift # On décale pour passer le reste des arguments

case "$COMMAND" in
    raster)
        /opt/tilefactory/raster2pmtiles.sh "$@"
        ;;
    vector)
        /opt/tilefactory/vector2pmtiles.sh "$@"
        ;;
    bash|shell)
        # Remplace le processus actuel par un shell interactif
        exec /bin/bash "$@"
        ;;
    daemon)
        # Boucle infinie silencieuse pour garder le conteneur en vie
        echo "♾️ Mode daemon activé. Le conteneur TileFactory tourne à l'infini."
        echo "👉 Utilisez 'docker exec -it <nom_conteneur> bash' pour y accéder."
        exec tail -f /dev/null
        ;;
    *)
        echo "Erreur : Commande '$COMMAND' non reconnue."
        echo "Usage: docker run tilefactory [raster|vector|daemon|bash] ..."
        exit 1
        ;;
esac