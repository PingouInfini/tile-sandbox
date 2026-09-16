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
  -co BLOCKSIZE=256 \
  -co OVERVIEWS=AUTO \
  -co BIGTIFF=IF_SAFER
```

### Explication des options

* **`-of COG`** : spécifie que le format de sortie doit être COG.
* **`-co COMPRESS=ZSTD`** : compresse les données avec l'algorithme Zstandard. Il offre un bon compromis entre taille du fichier et performances de lecture/écriture.
* **`-co BLOCKSIZE=256`** : définit la taille des blocs internes du fichier. Une taille de `256x256` constitue un bon compromis pour une lecture par tuiles.
* **`-co OVERVIEWS=AUTO`** : génère automatiquement les niveaux de résolution inférieurs (*overviews* ou pyramides), ce qui accélère l'affichage lorsque la carte est dézoomée.
* **`-co BIGTIFF=IF_SAFER`** : autorise automatiquement l'utilisation du format BigTIFF lorsque la taille du fichier risque de dépasser la limite historique de 4 Go du TIFF classique.

---

## 2. Déployer un serveur TiTiler

**TiTiler** est un serveur de tuiles dynamique permettant de lire des COG et de générer à la volée des tuiles XYZ / Web Mercator consommables par des bibliothèques cartographiques frontend telles que Leaflet, Mapbox ou MapLibre.

Voici une configuration `docker-compose.yml` pour lancer TiTiler en local avec plusieurs optimisations GDAL :

```yaml
services:
  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "18082:8000"

    # Lancement standard avec uvicorn.
    # Augmentez le nombre de workers selon les ressources CPU disponibles.
    command: [
      "uvicorn",
      "titiler.application.main:app",
      "--host",
      "0.0.0.0",
      "--port",
      "8000",
      "--workers",
      "2"
    ]

    environment:
      # Optimisations GDAL pour la lecture de COG à distance (HTTP/S3)
      # ou depuis le stockage local.
      - GDAL_CACHEMAX=75%
      - GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
      - GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
      - GDAL_HTTP_MULTIPLEX=YES
      - GDAL_HTTP_VERSION=2
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=536870912

    volumes:
      # Dossier contenant les fichiers .tif
      # accessible dans le conteneur sous /data
      - /docker/appdata/titiler/data:/data
```

---

## 3. Intégration côté Client (Frontend)

Une fois le serveur TiTiler lancé et les fichiers COG déposés dans le dossier mappé (par exemple `/data`), il est possible d'interroger l'API pour récupérer des tuiles dynamiques.

### Construction de l'URL TiTiler

TiTiler permet de lire directement un fichier en utilisant la matrice de tuilage `WebMercatorQuad`, standard utilisé par de nombreuses bibliothèques cartographiques :

```javascript
// Chemin du fichier TIF à l'intérieur du conteneur Docker TiTiler
const localTifPath = "/data/world.tif";

// URL de l'API TiTiler exposée sur le port 18082
const titilerUrl =
  `http://192.168.10.2:18082/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${localTifPath}`;
```

### Lancer l'exemple d'affichage

Un exemple complet d'intégration, avec gestion de plusieurs couches et de leur ordre d'affichage (`z-index`), est disponible dans :

```text
examples/maplibre/
```

Pour visualiser l'exemple, lancez un serveur HTTP statique à la racine du projet :

```bash
# Lance un serveur statique sur le port 8000
python -m http.server 8000
```

Ouvrez ensuite votre navigateur à l'adresse :

👉 http://localhost:8000/examples/maplibre/test_COG_maplibre.html

---

## 4. Jeux de données

Le projet utilise plusieurs jeux de données géospatiaux afin de disposer de cas d'usage couvrant à la fois la **classification de l'occupation des sols** et les **données d'élévation du terrain**.

Les données sont conservées sous forme de COG afin de pouvoir être exploitées efficacement par GDAL, TiTiler et les clients cartographiques.

### 4.1 ESA WorldCover 10 m — 2021 v200

Pour les données de type **occupation des sols (*land cover*)**, le projet s'appuie sur **ESA WorldCover 10 m 2021 v200**.

ESA WorldCover fournit une carte mondiale de l'occupation des sols à une résolution de **10 m**, produite à partir de données **Sentinel-1 et Sentinel-2**. Le produit 2021 v200 comporte **11 classes de couverture des sols**.

Le produit officiel est distribué par ESA notamment sous la forme de **18 macro-tuiles de 60° × 60°**, chacune contenant les tuiles sources de **3° × 3°**.

#### Téléchargement et génération du COG

Le téléchargement et la préparation du jeu de données sont automatisés par le script :

```text
data/COG/build_worldcover_cog.sh
```

L'objectif du script est de produire le fichier global suivant :

```text
data/COG/ESA_WorldCover_10m_2021_v200_GLOBAL.tif
```

Le fichier final est un :

* **GeoTIFF / BigTIFF / COG**
* résolution native de **10 m**
* CRS **EPSG:4326 (WGS 84)**
* données de classification conservées avec un rééchantillonnage **NEAREST**

#### Grandes étapes du script

Le script réalise successivement les opérations suivantes :

1. **Vérification de l'environnement**

   Les dépendances nécessaires sont contrôlées :

   ```text
   curl
   python3
   unzip
   gdalbuildvrt
   gdal_translate
   gdalinfo
   ```

   Le script vérifie également la version de GDAL et l'espace disque disponible. Une construction d'un COG mondial nécessite en effet plusieurs centaines de Go d'espace temporaire.

2. **Récupération de la liste officielle**

   Le script interroge l'API Zenodo pour récupérer automatiquement la liste des macro-tuiles correspondant à ESA WorldCover 2021 v200.

   Le jeu de données officiel est disponible ici :

   👉 https://zenodo.org/records/7254221

3. **Téléchargement des macro-tuiles**

   Les archives ZIP sont téléchargées avec `curl`, avec reprise des téléchargements interrompus grâce à :

   ```bash
   --continue-at -
   ```

   Après extraction, les archives ZIP sont supprimées afin de limiter l'espace disque utilisé.

4. **Recherche des tuiles sources**

   Les différents GeoTIFF de **3° × 3°** sont recherchés automatiquement dans le répertoire de données :

   ```bash
   find "${DATA_DIR}" \
       -type f \
       -name '*_Map.tif'
   ```

   Le script effectue ensuite un contrôle simple du nombre de tuiles trouvées et inspecte les informations spatiales d'une première tuile avec `gdalinfo`.

5. **Construction d'un VRT mondial**

   Toutes les tuiles sources sont assemblées virtuellement avec `gdalbuildvrt` :

   ```bash
   gdalbuildvrt \
     -overwrite \
     -resolution highest \
     -r nearest \
     -input_file_list "${FILELIST}" \
     "${VRT}"
   ```

   Le choix de **`NEAREST` est important** car WorldCover est une donnée catégorielle : il ne faut pas interpoler les valeurs de classes comme on le ferait pour une donnée continue telle qu'une altitude.

6. **Création du COG final**

   Le VRT est converti en COG avec `gdal_translate` :

   ```bash
   gdal_translate \
     "${VRT}" \
     "${OUTPUT}" \
     -of COG \
     -co BIGTIFF=YES \
     -co COMPRESS=ZSTD \
     -co LEVEL=9 \
     -co BLOCKSIZE=256 \
     -co PREDICTOR=2 \
     -co RESAMPLING=NEAREST \
     -co OVERVIEW_RESAMPLING=NEAREST \
     -co OVERVIEWS=AUTO
   ```

   Les overviews et le rééchantillonnage `NEAREST` sont conservés afin de préserver correctement les classes de land cover lors des changements de zoom.

7. **Validation du COG**

   Le fichier final est validé avec l'outil GDAL :

   ```bash
   python3 -m osgeo_utils.samples.validate_cloud_optimized_geotiff
   ```

#### Licence et attribution

ESA WorldCover est fourni gratuitement sans restriction d'utilisation selon les conditions indiquées par ESA. Les cartes publiées doivent notamment comporter une attribution appropriée.

Pour WorldCover 2021, la source officielle recommande notamment l'attribution :

```text
© ESA WorldCover project 2021 /
Contains modified Copernicus Sentinel data (2021)
processed by ESA WorldCover consortium
```

La référence de données officielle est :

```text
Zanaga, D. et al. (2022).
ESA WorldCover 10 m 2021 v200.
https://doi.org/10.5281/zenodo.7254221
```

---

### 4.2 Données d'élévation — `worldcog`

Pour les données d'élévation, le projet utilise le dataset Hugging Face :

👉 https://huggingface.co/datasets/OneAvailableUsername/worldcog

Ce dataset regroupe plusieurs **DEM / DTM sous forme de Cloud Optimized GeoTIFF**, conçus pour pouvoir être lus directement par requêtes HTTP *range* sans télécharger l'intégralité du raster.

Dans le cadre de ce projet, trois fichiers sont utilisés.

| Jeu de données                       | Résolution | Zone couverte                 | Source / nature     |
| ------------------------------------ | ---------: | ----------------------------- | ------------------- |
| `copernicus_world_30m_lerc.cog.tif`  |      ~30 m | Monde                         | Copernicus DEM      |
| `france_dtm_5m_lerc.cog.tif`         |        5 m | France métropolitaine + Corse | IGN RGE ALTI        |
| `lesdeuxalpes_dtm_0.5m_lerc.cog.tif` |      0,5 m | Domaine des Deux Alpes        | DTM dérivé du LiDAR |

#### 4.2.1 Copernicus World 30 m

Le fichier :

```text
copernicus_world_30m_lerc.cog.tif
```

correspond à un modèle numérique d'élévation mondial dérivé des données **Copernicus DEM**, avec une résolution d'environ **30 m**. Il est stocké en **EPSG:4326**, avec une bande `Float32` contenant les élévations en mètres.

Caractéristiques principales :

```text
Résolution    : ~30 m
CRS           : EPSG:4326
Type          : Float32
Bandes        : 1
Tuilage COG   : 512 × 512
Compression   : LERC_ZSTD
Overviews     : 11 niveaux
Taille        : ~125 GB
```

Le fichier utilise `LERC_ZSTD` avec une erreur verticale maximale annoncée de **1 m**. Il convient donc notamment à la visualisation et aux traitements où une précision verticale submétrique n'est pas requise.

Téléchargement :

```bash
wget -c "https://huggingface.co/datasets/OneAvailableUsername/worldcog/resolve/main/copernicus_world_30m_lerc.cog.tif"
```

---

#### 4.2.2 France DTM 5 m

Le fichier :

```text
france_dtm_5m_lerc.cog.tif
```

est un **modèle numérique de terrain (DTM)** couvrant la France métropolitaine et la Corse. Il est construit à partir des données **IGN RGE ALTI 5 m** puis assemblé sous la forme d'un COG unique.

Caractéristiques principales :

```text
Résolution    : 5 m
CRS           : EPSG:2154 (RGF93 / Lambert-93)
Type          : Float32
Bandes        : 1
Tuilage COG   : 512 × 512
Compression   : LERC_ZSTD
Overviews     : 9 niveaux
Taille        : ~28.3 GB
NoData        : -99999
```

La compression LERC est paramétrée avec une erreur verticale maximale de **1 cm** selon la fiche du dataset.

Téléchargement :

```bash
wget -c "https://huggingface.co/datasets/OneAvailableUsername/worldcog/resolve/main/france_dtm_5m_lerc.cog.tif"
```

---

#### 4.2.3 Les Deux Alpes DTM 0,5 m

Le fichier :

```text
lesdeuxalpes_dtm_0.5m_lerc.cog.tif
```

fournit un modèle numérique de terrain très haute résolution couvrant spécifiquement le domaine des **Deux Alpes, en Isère**.

Contrairement au MNT mondial Copernicus, il s'agit d'une donnée locale destinée à fournir un niveau de détail beaucoup plus fin. Le dataset indique qu'elle est dérivée de données **LiDAR** et qu'elle est destinée à compléter le DTM national de 5 m sur cette zone précise.

Caractéristiques principales :

```text
Résolution    : 0,5 m
CRS           : EPSG:2154 (RGF93 / Lambert-93)
Type          : Float32
Bandes        : 1
Tuilage COG   : 512 × 512
Compression   : LERC_ZSTD
Overviews     : 7 niveaux
Taille        : ~613 MB
NoData        : -9999
Emprise       : ~19,5 × 6,7 km
```

La donnée couvre essentiellement le domaine skiable des Deux Alpes et ne constitue donc pas un MNT national ou régional.

Téléchargement :

```bash
wget -c "https://huggingface.co/datasets/OneAvailableUsername/worldcog/resolve/main/lesdeuxalpes_dtm_0.5m_lerc.cog.tif"
```

---

### 4.3 Choix du dataset en fonction du niveau de zoom

Les trois jeux de données d'élévation permettent de couvrir plusieurs échelles :

```text
Vue mondiale
    ↓
Copernicus World 30 m
    ↓
France métropolitaine
    ↓
France DTM 5 m
    ↓
Zone locale / très haut niveau de zoom
    ↓
Les Deux Alpes DTM 0,5 m
```

L'idée est donc de privilégier le dataset adapté à l'emprise et au niveau de détail nécessaires :

* **Copernicus 30 m** : visualisation ou analyse à l'échelle mondiale.
* **France 5 m** : visualisation et analyse détaillée à l'échelle de la France métropolitaine.
* **Les Deux Alpes 0,5 m** : très haut niveau de zoom sur une zone locale.

Le dataset `worldcog` est conçu pour exploiter directement le caractère *cloud optimized* des fichiers : GDAL peut notamment accéder à un COG distant via `/vsicurl/` sans télécharger l'intégralité du raster.

Exemple :

```bash
gdalinfo \
  /vsicurl/https://huggingface.co/datasets/OneAvailableUsername/worldcog/resolve/main/france_dtm_5m_lerc.cog.tif
```

Il est également possible d'ouvrir ces fichiers directement avec `rasterio` et de ne lire qu'une fenêtre spatiale du raster.

> **Attention :** les fichiers n'utilisent pas tous le même système de coordonnées. Le raster mondial Copernicus est en `EPSG:4326`, tandis que le DTM français et celui des Deux Alpes sont en `EPSG:2154` (Lambert-93). Il ne faut donc pas supposer qu'un même CRS s'applique à tous les jeux de données.

### 4.4 Licence et attribution des données d'élévation

Le dataset Hugging Face indique deux familles de sources et de licences :

* **Copernicus World 30 m** : dérivé du Copernicus DEM, avec les conditions de licence applicables aux données Copernicus.
* **France / Les Deux Alpes** : données dérivées de données IGN, notamment **RGE ALTI** et, pour Les Deux Alpes, de données **IGN LiDAR HD**, sous les conditions de la **Licence Ouverte / Open Licence 2.0 (Etalab)** avec attribution IGN.

Pour toute redistribution ou utilisation dans une application publique, vérifier les conditions de licence et les obligations d'attribution correspondant à la donnée source utilisée.

---

## 5. Résumé de l'architecture

Le fonctionnement global du projet peut être résumé ainsi :

```text
                    ┌─────────────────────────┐
                    │      Jeux de données    │
                    ├─────────────────────────┤
                    │ ESA WorldCover 10 m     │
                    │ Copernicus DEM 30 m     │
                    │ France DTM 5 m           │
                    │ Les Deux Alpes DTM 0.5 m │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      GeoTIFF / COG       │
                    │ tuilage + overviews      │
                    │ compression optimisée    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │         TiTiler          │
                    │ génération de tuiles     │
                    │       à la demande       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Frontend MapLibre /      │
                    │ Leaflet / autre client   │
                    └─────────────────────────┘
```

Cette architecture permet de conserver les données dans leur format raster optimisé et de ne transférer au navigateur que les portions nécessaires à l'affichage courant.
