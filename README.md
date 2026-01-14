# Mbtileserver

### Prérequis

Créer les path sur le host

mkdir -p /docker/appdata/mbtileserver/{fonts,mbtiles,pmtiles}

----------------------------------------------------------------------------------------------------------------

### Données

- Copier les images docker (fichiers .tar) quelque part sur le disque
- Copier le fichier `maptiler-osm-2020-02-10-v3.11-planet.mbtiles` dans `/docker/appdata/mbtileserver/mbtiles` (issue de https://filigran-marketplace-assets.s3.eu-west-3.amazonaws.com/maptiler-osm-2020-02-10-v3.11-planet.mbtiles)
- Copier le fichier `20260114.pmtiles` dans `/docker/appdata/mbtileserver/pmtiles` (issue de https://maps.protomaps.com/builds/)
- Copier l'archive `fonts.tar.gz` sur le disque et l'extraire dans `/docker/appdata/mbtileserver/fonts` avec la commande:
  - `tar -xzf fonts.tar.gz --strip-components=1 -C /docker/appdata/mbtileserver/fonts`
- Gestion des droits:
  - sudo chown -R <admin>:<admin> /docker/appdata/mbtileserver
  - sudo chown -R 101:101 /docker/appdata/mbtileserver/fonts
  - sudo chmod -R 755 /docker/appdata/mbtileserver

----------------------------------------------------------------------------------------------------------------

### Configuration Nginx

cf assets/nginx

A créer dans /docker/appdata/mbtileserver/nginx-map-assets.conf

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