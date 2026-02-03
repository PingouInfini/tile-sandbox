# Tile-sandbox

### Prérequis

Créer les path sur le host

```
mkdir -p /docker/appdata/tileserver/{fonts,mbtiles,pmtiles,examples,nginx,tileserver-gl}
mkdir -p /docker/appdata/tileserver/graphhopper/data
mkdir -p /docker/appdata/tileserver/photon/data
```

----------------------------------------------------------------------------------------------------------------

### Données

- Docker
  - Copier les images docker (fichiers .tar) quelque part sur le disque

---

- MBTiles
  - Copier le fichier `maptiler-osm-2020-02-10-v3.11-planet.mbtiles` dans `/docker/appdata/tileserver/mbtiles/` *(issu de https://filigran-marketplace-assets.s3.eu-west-3.amazonaws.com/maptiler-osm-2020-02-10-v3.11-planet.mbtiles)*
  - Copier le fichier `paris_sudouest.mbtiles` dans `/docker/appdata/tileserver/mbtiles/` *(construit à partir de paris_sudouest.ecw)*
    
  -  > cf [data/mbtiles/README.md](./data/mbtiles/README.md) pour les autres actions

---

- PMTiles
  - Copier le fichier `20260114.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(issu de https://maps.protomaps.com/builds/)*
    > renommer `AAAAMMJJ.pmtiles` en `world.pmtiles`
  - Copier le fichier `alpes_elevation.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(extrait de https://download.mapterhorn.com/planet.pmtiles)*
  - Copier le fichier `corse_elevation.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(extrait de https://download.mapterhorn.com/planet.pmtiles)*
  
  -  > cf [data/pmtiles/README.md](./data/pmtiles/README.md) pour les autres actions

---

- Tileserver-gl
  - Copier le contenu de `assets/tileserver-gl` dans `/docker/appdata/tileserver/tileserver-gl/`

---

- NGINX *(nginx-map-assets)*
  - Copier le contenu de `assets/nginx` dans `/docker/appdata/tileserver/nginx/` 

---

- Graphhopper
  - Copier le fichier `france-latest.osm.pbf` dans `/docker/appdata/tileserver/graphhopper/data/` *(issu de https://download.geofabrik.de/)*

---

- Photon
  - Copier le répertoire `data` dans `/docker/appdata/tileserver/photon/` *(issu d'une instance photon-docker online)*

---

- FONT
  - Copier l'archive `fonts.tar.gz` sur le disque et l'extraire dans `/docker/appdata/tileserver/fonts/` avec la commande:
    ```
    tar -xzf fonts.tar.gz --strip-components=1 -C /docker/appdata/tileserver/fonts
    ```

---

- Exemples
  - Copier le contenu de `examples` dans `/docker/appdata/tileserver/examples/`  

---

- Gestion des droits:
  - sudo chown -R [admin]:[admin] /docker/appdata/tileserver
  - sudo chown -R 101:101 /docker/appdata/tileserver/fonts
  - sudo chown -R 101:101 /docker/appdata/tileserver/examples
  - sudo chmod -R 755 /docker/appdata/tileserver

----------------------------------------------------------------------------------------------------------------

### Configuration Nginx

cf [assets/nginx/nginx-map-assets.conf](./assets/nginx/nginx-map-assets.conf)

----------------------------------------------------------------------------------------------------------------

### Docker

Charger les images dockers:

```
docker load -i mbtileserver.tar
docker load -i nginx.tar
docker load -i tileserver-gl.tar
docker load -i graphhopper.tar
docker load -i photon.tar
```

et créer la stack décrite dans [docker/docker-compose.yml](./docker/docker-compose.yml)

----------------------------------------------------------------------------------------------------------------

### Exemples

- mbtiles
  - test_tileserver-gl_mbtiles_leaflet.html
  - test_mbtileserver_mbtiles_maplibre.html
- pmtiles
  - test_nginx_pmtiles_maplibre.html

🚧 Adapter l'ip dans : 🚧
- maplibre/js/config.js
- leaflet/test_tileserver-gl_mbtiles_leaflet.html
