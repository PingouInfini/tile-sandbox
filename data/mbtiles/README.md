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

### QGIS -> Mbtiles

Pour info: paris SO pour nv 0-18 = 12634 tuiles et ~30min
> Traitement > Boite à outil > Outils raster > Générer MBTiles

```
Version de QGIS : 3.40.15-Bratislava
Révision du code : f68f1bf573
Version de Qt : 5.15.13
Version de Python : 3.12.12
Version de GDAL : 3.12.1
Version de GEOS : 3.14.1-CAPI-1.20.5
Version de Proj : Rel. 9.7.1, December 1st, 2025
Version de PDAL : 2.9.0 (git-version: 69639b)
Algorithme commencé à: 2026-01-31T23:15:51
Démarrage de l'algorithme 'Générer des tuiles XYZ (MBTiles)'…
Paramètres en entrée:
{ 'ANTIALIAS' : True, 'BACKGROUND_COLOR' : QColor(0, 0, 0, 0), 'DPI' : 96, 'EXTENT' : '210773.741600000,254207.192400000,6167102.578400000,6246849.242100000 []', 'METATILESIZE' : 4, 'OUTPUT_FILE' : 'TEMPORARY_OUTPUT', 'QUALITY' : 75, 'TILE_FORMAT' : 0, 'ZOOM_MAX' : 18, 'ZOOM_MIN' : 0 }

1 tuiles seront créées pour le niveau de zoom 0
1 tuiles seront créées pour le niveau de zoom 1
1 tuiles seront créées pour le niveau de zoom 2
1 tuiles seront créées pour le niveau de zoom 3
1 tuiles seront créées pour le niveau de zoom 4
1 tuiles seront créées pour le niveau de zoom 5
1 tuiles seront créées pour le niveau de zoom 6
1 tuiles seront créées pour le niveau de zoom 7
1 tuiles seront créées pour le niveau de zoom 8
1 tuiles seront créées pour le niveau de zoom 9
1 tuiles seront créées pour le niveau de zoom 10
2 tuiles seront créées pour le niveau de zoom 11
6 tuiles seront créées pour le niveau de zoom 12
15 tuiles seront créées pour le niveau de zoom 13
45 tuiles seront créées pour le niveau de zoom 14
153 tuiles seront créées pour le niveau de zoom 15
594 tuiles seront créées pour le niveau de zoom 16
2376 tuiles seront créées pour le niveau de zoom 17
9432 tuiles seront créées pour le niveau de zoom 18
Un total de 12634 tuiles sera créé
```


### Outil nécessaire : GDAL pour Windows

1. Télécharger : [https://trac.osgeo.org/osgeo4w/](https://trac.osgeo.org/osgeo4w/)
2. Choisir **Advanced Install**
3. Sélectionner :

   * `gdal`
   * `gdal-ecw` (important pour lire les ECW)
4. Laisse l’installateur finir



### Générer un mbtiles à partir d'un raster (ECW, GeoTIFF, JPEG2000)

1. Ouvrir la console OSGeo4W

2. Reprojection ECW → GeoTIFF WebMercator

⚠️ Le GeoTIFF sera gros (plusieurs dizaines de Go)

```
gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS paris_sudouest.ecw paris_sudouest_3857.tif
```

3. On crée le MBTiles au niveau de zoom maximal (ex: 18)
   > Une astuce supplémentaire : Si vous trouvez que le fichier est trop lourd en PNG, vous pouvez ajouter -co QUALITY=75 -co TILE_FORMAT=JPEG dans le gdal_translate. Le JPEG est souvent 5 à 10 fois plus léger pour de l'imagerie aérienne.

```
gdal_translate paris_sudouest_3857.tif paris_sudouest.mbtiles -of MBTILES -co TILE_FORMAT=PNG -co MINZOOM=0 -co MAXZOOM=18 -co ZOOM_LEVEL_STRATEGY=UPPER
```

- crée un GeoTIFF tuilé : -co TILED=YES
- compression sans perte, garde toute la qualité : -co COMPRESS=DEFLATE


4. On génère TOUS les zooms inférieurs d'un coup (la pyramide)

```
gdaladdo -r average paris_sudouest.mbtiles 2 4 8 16 32 64 128 256 512 1024 2048 4096 8192 16384 32768 65536 131072 262144
```

5. Correction manuelle des métadonnées (si nécessaire)
Si après cela, un SELECT * FROM metadata affiche toujours minzoom | 9, c'est que GDAL refuse d'écrire "0" car il juge les tuiles trop vides. Vous pouvez le forcer très facilement puisque c'est du SQLite :

```
sqlite3 paris_sudouest_final.mbtiles "UPDATE metadata SET value='0' WHERE name='minzoom';"
```

### Générer un mbtiles à partir d'un vectoriel (shapefiles, GeoJSON, PostGIS)
```
ogr2ogr -f GeoJSON -t_srs EPSG:3857 output.geojson input.shp
tippecanoe -o map.mbtiles -zg --drop-densest-as-needed output.geojson
```

Pour tippecanoe:
- Détermine automatiquement les niveaux de zoom : -zg
- Supprime certains points dans les zones très denses pour réduire la taille : --drop-densest-as-needed
Ppermet de conserver des tuiles aux plus grands zooms si elles ont été tronquées: --extend-zooms-if-still-dropping