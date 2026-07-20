# 🌍 Gestion des Cloud Optimized GeoTIFF (COG)

Ce guide détaille comment convertir des images satellitaires ou rasters au format **COG (Cloud Optimized GeoTIFF)**, déployer un serveur de tuiles dynamiques (**TiTiler**) et afficher ces données cartographiques dans une application web frontend.

---

## 1. Convertir un GeoTIFF en COG

À partir de GDAL ≥ 3.1, il existe un driver natif dédié pour la création de fichiers COG. 
La commande suivante permet de transformer un `.tif` classique en un COG hautement optimisé :

```bash
gdal_translate D:\workspace\COG\paris_sudouest_3857.tif D:\workspace\COG\paris_sudouest_3857_COG.tif \
  -of COG \
  -co COMPRESS=ZSTD \
  -co BLOCKSIZE=512 \
  -co OVERVIEWS=AUTO \
  -co BIGTIFF=IF_SAFER
```

### Explication des options :
* **`-of COG`** : Spécifie que le format de sortie doit être COG.
* **`-co COMPRESS=ZSTD`** : Compresse les données en utilisant l'algorithme Zstandard. Il offre un excellent ratio et une vitesse de compression/décompression optimale.
* **`-co BLOCKSIZE=512`** : Définit la taille des blocs internes (tuiles) du fichier COG. Une taille de 512x512 pixels est généralement le meilleur compromis pour une lecture fluide sur le web.
* **`-co OVERVIEWS=AUTO`** : Génère automatiquement des "overviews" (niveaux de résolution inférieurs ou pyramides) pour accélérer considérablement l'affichage lorsqu'on dézoome sur la carte.
* **`-co BIGTIFF=IF_SAFER`** : Autorise la création de fichiers TIFF dépassant la limite historique des 4 Go, de manière sécurisée (activé uniquement si nécessaire).

---

## 2. Déployer un serveur TiTiler

**TiTiler** est un serveur de tuiles dynamique qui permet de lire les fichiers COG et de générer à la volée des tuiles XYZ (Web Mercator) lisibles par n'importe quelle librairie cartographique frontend (Leaflet, Mapbox, MapLibre, etc.).

Voici la configuration `docker-compose.yml` pour lancer un serveur TiTiler en local avec les optimisations GDAL recommandées :

```yaml
services:
  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "18082:8000"
    # Lancement standard avec uvicorn (augmentez les workers selon vos cœurs CPU disponibles)
    command: ["uvicorn", "titiler.application.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
    environment:
      # Configurations GDAL indispensables pour optimiser la lecture des COG à distance (HTTP/S3) ou en local
      - GDAL_CACHEMAX=75%
      - GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
      - GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
      - GDAL_HTTP_MULTIPLEX=YES
      - GDAL_HTTP_VERSION=2
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=536870912
    volumes:
      # Montage du dossier contenant vos fichiers .tif vers le dossier /data du conteneur
      - /docker/appdata/titiler/data:/data
```

---

## 3. Intégration côté Client (Frontend)

Une fois le serveur TiTiler lancé et les fichiers COG déposés dans le dossier mappé (ex: `/data`), vous pouvez interroger l'API pour récupérer des tuiles dynamiques.

### Construction de l'URL TiTiler
TiTiler permet de lire directement un fichier en utilisant la matrice `WebMercatorQuad`, qui est le standard utilisé par les librairies comme Leaflet :

```javascript
// Définition du chemin de votre fichier TIF à l'intérieur du conteneur Docker TiTiler
const localTifPath = "/data/world.tif";

// Construction de l'URL de l'API TiTiler (Exposée sur le port 18082)
const titilerUrl = `http://192.168.10.2:18082/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${localTifPath}`;
```

### Lancer l'exemple d'affichage

Un exemple complet d'intégration (avec gestion de plusieurs couches et de l'ordre d'affichage z-index) est disponible dans le dossier `examples/maplibre/`. 

Pour visualiser l'exemple, lancez un serveur HTTP statique à la racine du projet :

```bash
# Lance un serveur statique sur le port 8000
python -m http.server 8000
```

Ouvrez ensuite votre navigateur sur l'adresse suivante :
👉 [http://localhost:8000/examples/maplibre/test_COG_maplibre.html](http://localhost:8000/examples/maplibre/test_COG_maplibre.html)