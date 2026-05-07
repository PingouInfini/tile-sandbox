# 🏭 TileFactory

**TileFactory** est un pipeline complet conteneurisé pour transformer vos données SIG (Raster & Vector) en archives **PMTiles** optimisées.

Conçu pour fonctionner en environnement **offline (Airgap)**, il embarque les meilleurs outils (GDAL, Tippecanoe, Protomaps) dans une image Docker unique.

## 🚀 Fonctionnalités
- 🖼️ **Raster Flow** : Convertit `.ecw` et `.tif` (GeoTIFF) vers PMTiles.
- 📐 **Vector Flow** : Convertit `.shp` et `.geojson` vers PMTiles.
- ⚡ **Optimisation** : Compression JPEG intelligente pour l'imagerie, calcul automatique de pyramides.
- 📦 **Offline-Ready** : Buildé une fois, déployable partout sans internet.

---

## 🛠️ Installation & Build (Machine Online)

1. Clonez ce dépôt.
2. Construisez l'image :
   ```bash
   docker build -t pingouinfinihub/tilefactory:latest .
   ```
3. Tag et push de la version   
   ```bash
   docker tag tilefactory:latest pingouinfinihub/tilefactory:latest
   docker push pingouinfinihub/tilefactory:latest
   ```
3bis. Exportez l'image pour l'environnement offline :
   ```bash
   docker save tilefactory > tilefactory_image.tar
   ```
---

## 📖 Usage (Machine Offline)

Importez d'abord l'image :
```bash
docker load < tilefactory_image.tar
```

### 🖼️ Traitement Raster (ECW ou GeoTIFF)
La commande gère automatiquement la reprojection en WebMercator (EPSG:3857) et génère les zooms de 0 à 18.
```bash
docker run --rm -v $(pwd):/data pingouinfinihub/tilefactory:latest raster mon_image.ecw result.pmtiles
# OU
docker run --rm -v $(pwd):/data pingouinfinihub/tilefactory:latest raster orthophoto.tif result.pmtiles
```

### 📐 Traitement Vectoriel (Shapefile ou GeoJSON)
Utilise Tippecanoe pour un découpage optimal.
```bash
docker run --rm -v $(pwd):/data pingouinfinihub/tilefactory:latest vector limites.shp result.pmtiles
```

# Le mode "Daemon" (Tâche de fond)
Vous lancez le conteneur une fois, il reste allumé en arrière-plan, et vous "entrez" dedans quand vous en avez besoin.

```bash
# 1. On lance le conteneur en mode détaché (-d), on lui donne un nom, et on map le volume
docker run -d --name my-tilefactory -v $(pwd):/data pingouinfini/tilefactory:latest daemon

# 2. Quand vous voulez travailler dedans, vous ouvrez un terminal à l'intérieur :
docker exec -it my-tilefactory bash

# 3. Vous êtes maintenant dans le conteneur ! Vous pouvez lancer vos scripts manuellement :
# root@container:/data# /opt/tilefactory/raster2pmtiles.sh BORDEAUX.tif result.pmtiles
```

### Le mode "Shell" direct
Si vous voulez juste lancer un environnement jetable pour tester des commandes GDAL à la volée.
Le terminal va s'attacher directement au conteneur. Quand vous taperez exit, le conteneur sera détruit.

```bash
docker run -it --rm -v $(pwd):/data pingouinfini/tilefactory:latest bash
```

---

## ⚙️ Détails techniques du pipeline Raster
1. **gdalwarp** : Passage en EPSG:3857 (WebMercator).
2. **gdal_translate** : Conversion en MBTiles compressé (JPEG 75% par défaut).
3. **gdaladdo** : Génération de tous les niveaux de zooms inférieurs (pyramide).
4. **sqlite3** : Forçage du `minzoom` à 0 dans les métadonnées.
5. **pmtiles convert** : Empaquetage final.

---

## ⚠️ Notes sur le format ECW
Le support ECW dans GDAL est souvent lié à des librairies propriétaires. 
Si votre fichier ECW n'est pas lu nativement, convertissez-le en GeoTIFF (`.tif`) sur votre station de travail avant de le passer à **TileFactory**.
