C'est une excellente question, et c'est ici que l'on rentre dans le cœur de l'ingénierie cartographique ! 

Avant de commencer le pas à pas, je dois faire preuve de franchise avec vous sur une **règle d'or en cartographie** : *on ne fait jamais de calculs ou de traitements sur des données encodées pour l'affichage visuel.*

Vos fichiers actuels `alpes_elevation.pmtiles` et `corse_elevation.pmtiles` sont très probablement encodés au format **Terrarium RGB** ou **Mapbox Terrain-RGB**. Cela signifie que l'élévation (en mètres) a été convertie en couleurs (Rouge, Vert, Bleu) pour être lue par WebGL. Essayer de re-décoder ces couleurs en mètres, d'y ajouter des bâtiments, puis de les ré-encoder en couleurs va générer des erreurs d'arrondis massives, une perte de qualité, et c'est un cauchemar technique.

**La bonne approche :** Vous devez repartir d'un **MNT brut (en GeoTIFF)** avec les vraies valeurs d'élévation en mètres (par exemple des données Copernicus ou de l'IGN), y ajouter les bâtiments extraits de votre `world.pmtiles`, puis encoder le résultat final en un nouveau `.pmtiles`.

Voici la méthode complète, de A à Z, en utilisant des **composants Dockerisés** pour que cela fonctionne parfaitement sur votre Windows 11.

---

### Pré-requis sur votre Windows 11

1. **Docker Desktop** installé et démarré.
2. Un dossier de travail (ex: `C:\workspace\map_data\`).
3. Placez votre `world.pmtiles` dans ce dossier.
4. Téléchargez un MNT brut en `.tif` pour la Corse (ex: `corse_mnt_brut.tif`) et placez-le dans ce dossier. *(Si vous n'en avez pas, je pourrai vous indiquer où les trouver à l'étape suivante).*

Ouvrez un terminal (PowerShell) dans ce dossier `C:\workspace\map_data\`. Dans les commandes ci-dessous, nous utiliserons `${PWD}` pour lier votre dossier local au dossier `/data` dans Docker.

---

### Étape 1 : Extraire les bâtiments (Vector) en GeoJSON

Nous allons utiliser l'image officielle de GDAL pour lire votre fichier vectoriel `world.pmtiles`, cibler la couche `buildings`, filtrer ceux qui ont une hauteur (`height`), et les exporter pour la bounding box de la Corse.

```powershell
docker run --rm -v ${PWD}:/data ghcr.io/osgeo/gdal:ubuntu-small-latest ogr2ogr `
  -f GeoJSON /data/corse_buildings.geojson `
  /data/world.pmtiles `
  -sql "SELECT height, geometry FROM buildings WHERE height IS NOT NULL" `
  -spat 8.53 41.33 9.56 43.05
```
*Le résultat : Un fichier `corse_buildings.geojson` contenant les polygones des bâtiments et leur hauteur.*

---

### Étape 2 : Rastériser les bâtiments (créer un GeoTIFF des hauteurs)

Il faut maintenant transformer ces polygones en une image (raster) qui se superpose exactement à votre MNT brut. Nous utilisons `gdal_rasterize`. 

*Note : Remplacez les valeurs de `-te` (étendue) et `-tr` (résolution X/Y) par celles de votre fichier `corse_mnt_brut.tif`. Vous pouvez les obtenir avec la commande `gdalinfo /data/corse_mnt_brut.tif`.*

```powershell
docker run --rm -v ${PWD}:/data ghcr.io/osgeo/gdal:ubuntu-small-latest gdal_rasterize `
  -a height `
  -te 8.53 41.33 9.56 43.05 `
  -tr 0.00027777778 0.00027777778 `
  -a_nodata 0 `
  /data/corse_buildings.geojson `
  /data/corse_buildings.tif
```
*Le résultat : Un fichier `corse_buildings.tif` où les pixels sans bâtiments valent `0` et les pixels avec bâtiments valent la hauteur du bâtiment (ex: `15` pour 15 mètres).*

---

### Étape 3 : Calculer le MNS (MNT + Bâtiments)

Maintenant, nous allons faire une simple addition mathématique pixel par pixel : Élévation du terrain + Hauteur du bâtiment = Hauteur totale (Modèle Numérique de Surface). Nous utilisons `gdal_calc.py`.

```powershell
docker run --rm -v ${PWD}:/data ghcr.io/osgeo/gdal:ubuntu-small-latest gdal_calc.py `
  -A /data/corse_mnt_brut.tif `
  -B /data/corse_buildings.tif `
  --calc="A+B" `
  --NoDataValue=-9999 `
  --outfile=/data/corse_mns.tif
```
*Le résultat : Un fichier `corse_mns.tif`. C'est votre modèle final avec les bâtiments physiquement incrustés dans le terrain.*

---

### Étape 4 : Encoder le MNS en RGB (Terrarium ou Mapbox)

Deck.gl a besoin de tuiles encodées en couleurs pour générer la 3D via le GPU. L'outil standard pour cela est `rio-rgbify`. Comme il est basé sur Python, nous allons lancer un conteneur Python temporaire, l'installer et faire l'encodage.

```powershell
# 1. On lance un conteneur interactif
docker run -it --rm -v ${PWD}:/data python:3.9 bash

# --- (Vous êtes maintenant DANS le conteneur) ---

# 2. On installe l'outil
pip install rasterio rio-rgbify

# 3. On encode (ici au format Mapbox Terrain-RGB, base -10000, intervalle 0.1)
rio rgbify -b -10000 -i 0.1 /data/corse_mns.tif /data/corse_mns_rgb.tif

# 4. On quitte le conteneur
exit
```
*Le résultat : Un fichier `corse_mns_rgb.tif` qui ressemble visuellement à une image multicolore psychédélique.*

---

### Étape 5 : Créer les tuiles et générer le PMTiles final

Enfin, nous transformons ce grand GeoTIFF coloré en tuiles standard (MBTiles), puis nous le convertissons au format ultra-optimisé PMTiles. On réutilise l'image GDAL.

```powershell
# 1. Création des tuiles PNG (zoom 0 à 14 par exemple) encapsulées dans un MBTiles
docker run --rm -v ${PWD}:/data ghcr.io/osgeo/gdal:ubuntu-small-latest gdal_translate `
  -of MBTILES -co TILE_FORMAT=PNG -co ZOOM_LEVEL_STRATEGY=AUTO `
  /data/corse_mns_rgb.tif /data/corse_mns_rgb.mbtiles

# 2. Ajout des vues d'ensemble (overviews) pour que tous les niveaux de zoom fonctionnent
docker run --rm -v ${PWD}:/data ghcr.io/osgeo/gdal:ubuntu-small-latest gdaladdo `
  -r nearest /data/corse_mns_rgb.mbtiles 2 4 8 16 32

# 3. Conversion finale en PMTiles via l'outil go-pmtiles
docker run --rm -v ${PWD}:/data protomaps/go-pmtiles convert `
  /data/corse_mns_rgb.mbtiles /data/corse_mns_final.pmtiles
```

**Victoire !** Vous avez maintenant votre `corse_mns_final.pmtiles` prêt à être injecté dans Deck.gl. Les bâtiments seront traités comme s'ils faisaient partie de la montagne, ce qui rendra votre algorithme de *Line of Sight* (via Raymarching dans le shader) instantané.

Voulez-vous que je vous indique où télécharger gratuitement les dalles de MNT brut (GeoTIFF) pour la Corse et les Alpes pour démarrer cette procédure ?