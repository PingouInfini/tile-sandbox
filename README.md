# Tile-sandbox

### Prérequis

Créer les path sur le host

mkdir -p /docker/appdata/tileserver/{fonts,mbtiles,pmtiles,examples,nginx,tileserver-gl}
mkdir -p /docker/appdata/tileserver/graphhopper/data
mkdir -p /docker/appdata/tileserver/photon/data

----------------------------------------------------------------------------------------------------------------

### Données

- Copier les images docker (fichiers .tar) quelque part sur le disque
- Copier le fichier `maptiler-osm-2020-02-10-v3.11-planet.mbtiles` dans `/docker/appdata/tileserver/mbtiles` (issue de https://filigran-marketplace-assets.s3.eu-west-3.amazonaws.com/maptiler-osm-2020-02-10-v3.11-planet.mbtiles)
- Copier le fichier `20260114.pmtiles` dans `/docker/appdata/tileserver/pmtiles` (issue de https://maps.protomaps.com/builds/)
  > renommer `AAAAMMJJ.pmtiles` en `world.pmtiles`
- Copier le fichier `france-latest.osm.pbf` dans `/docker/appdata/tileserver/graphhopper/data` (issue de https://download.geofabrik.de/)
- Copier l'archive `fonts.tar.gz` sur le disque et l'extraire dans `/docker/appdata/tileserver/fonts` avec la commande:
  ```
  tar -xzf fonts.tar.gz --strip-components=1 -C /docker/appdata/tileserver/fonts
  ```
- Copier le contenu de `examples` dans `/docker/appdata/tileserver/examples`  
- Copier le contenu de `assets/tileserver-gl` dans `/docker/appdata/tileserver/tileserver-gl` 
- Copier le contenu de `assets/nginx` dans `/docker/appdata/tileserver/nginx` 
- Gestion des droits:
  - sudo chown -R [admin]:[admin] /docker/appdata/tileserver
  - sudo chown -R 101:101 /docker/appdata/tileserver/fonts
  - sudo chown -R 101:101 /docker/appdata/tileserver/examples
  - sudo chmod -R 755 /docker/appdata/tileserver

----------------------------------------------------------------------------------------------------------------

### Configuration Nginx

cf assets/nginx

----------------------------------------------------------------------------------------------------------------

### Docker

Charger les images dockers:

```
docker load -i mbtileserver.tar
docker load -i nginx.tar
docker load -i tileserver-gl.tar
```

et créer la stack décrite dans docker/docker-compose.yml

----------------------------------------------------------------------------------------------------------------

### Exemples

- mbtiles
  - test_tileserver-gl_mbtiles_leaflet.html
  - test_mbtileserver_mbtiles_maplibre.html
- pmtiles
  - test_nginx_pmtiles_maplibre.html

Adapter l'ip dans les html d'exemple
