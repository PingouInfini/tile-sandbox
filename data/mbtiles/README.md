# mbtiles

### Dataset

https://filigran-marketplace-assets.s3.eu-west-3.amazonaws.com/maptiler-osm-2020-02-10-v3.11-planet.mbtiles

> maptiler-osm-2020-02-10-v3.11-planet.mbtiles
> 73Go


### Visualiser les datas (infos générales et liste des layers vectoriels)

```
sqlite3 mon_fichier.mbtiles

sqlite>
```

```
SELECT * FROM metadata;

SELECT value FROM metadata WHERE name='json' OR name='vector_layers';
```

```
.quit
```




### Outil nécessaire : GDAL pour Windows

1. Télécharger : [https://trac.osgeo.org/osgeo4w/](https://trac.osgeo.org/osgeo4w/)
2. Choisir **Advanced Install**
3. Sélectionner :

   * `gdal`
   * `gdal-ecw` (important pour lire les ECW)
4. Laisse l’installateur finir
5. Ouvrir la console OSGeo4W

6. Reprojection ECW → GeoTIFF WebMercator

⚠️ Le GeoTIFF sera gros (plusieurs dizaines de Go)

```
gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS paris_sudouest.ecw paris_sudouest_3857.tif
```

7. Générer les overviews
```
gdaladdo -r average paris_sudouest_3857.tif 2 4 8 16 32
```

8. Génération du MBTiles
```
gdal_translate paris_sudouest_3857.tif paris_sudouest.mbtiles -of MBTILES -co TILE_FORMAT=PNG -co ZOOM_LEVEL_STRATEGY=LOWER -co MINZOOM=12 -co MAXZOOM=22 -co RESAMPLING=BILINEAR
```

**************
* OLD 
**************


6. Commande de conversion directe

```bat
gdal_translate input.ecw output.mbtiles -of MBTILES -co TILE_FORMAT=JPEG -co QUALITY=85
```

* `-of MBTILES` : format de sortie
* `TILE_FORMAT=JPEG` : plus léger (PNG si besoin de transparence)
* `QUALITY=85` : bon compromis qualité/poids

### Si nécessité d'avoir des niveaux de zoom précis

```bat
gdal_translate input.ecw temp.tif
gdaladdo -r average temp.tif 2 4 8 16 32
gdal_translate temp.tif output.mbtiles -of MBTILES
```



### Générer un mbtiles à partir d'un raster (ECW, GeoTIFF, JPEG2000)

1) Convertir GeoTIFF en MBTiles
```
gdal_translate -of MBTILES -co TILE_FORMAT=PNG -co QUALITY=80 input.tif map.mbtiles
```

- Pour JPEG plutôt que PNG : -co TILE_FORMAT=JPEG
- Pour compresser et réduire la taille : -co QUALITY=75

2) Ajouter pyramides de zoom
```
gdaladdo -r average map.mbtiles 2 4 8 16 32
```

3) Ou pour conserver la qualité de base
```
gdal_translate -co TILED=YES -co COMPRESS=DEFLATE input.tif clean.tif
gdaladdo -r average clean.tif 2 4 8 16 32
gdal_translate -of MBTILES -co TILE_FORMAT=PNG clean.tif map.mbtiles
gdaladdo -r average map.mbtiles 2 4 8 16 32
```

- crée un GeoTIFF tuilé : -co TILED=YES
- compression sans perte, garde toute la qualité : -co COMPRESS=DEFLATE

### Générer un mbtiles à partir d'un vectoriel (shapefiles, GeoJSON, PostGIS)
```
ogr2ogr -f GeoJSON -t_srs EPSG:3857 output.geojson input.shp
tippecanoe -o map.mbtiles -zg --drop-densest-as-needed output.geojson
```

Pour tippecanoe:
- Détermine automatiquement les niveaux de zoom : -zg
- Supprime certains points dans les zones très denses pour réduire la taille : --drop-densest-as-needed
Ppermet de conserver des tuiles aux plus grands zooms si elles ont été tronquées: --extend-zooms-if-still-dropping