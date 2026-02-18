# Tile-sandbox

## Données

### Docker
  - Copier les images docker (fichiers .tar) quelque part sur le disque

---

### MBTiles
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/mbtiles
    ```
  - Copier le fichier `maptiler-osm-2020-02-10-v3.11-planet.mbtiles` dans `/docker/appdata/tileserver/mbtiles/` *(issu de https://filigran-marketplace-assets.s3.eu-west-3.amazonaws.com/maptiler-osm-2020-02-10-v3.11-planet.mbtiles)*
  - Copier le fichier `paris_sudouest.mbtiles` dans `/docker/appdata/tileserver/mbtiles/` *(construit à partir de paris_sudouest.ecw)*
    
  -  > cf [data/mbtiles/README.md](./data/mbtiles/README.md) pour les autres actions

---

### PMTiles
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/pmtiles
    ```
  - Copier le fichier `20260114.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(issu de https://maps.protomaps.com/builds/)*
    > renommer `AAAAMMJJ.pmtiles` en `world.pmtiles`
  - Copier le fichier `alpes_elevation.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(extrait de https://download.mapterhorn.com/planet.pmtiles)*
  - Copier le fichier `corse_elevation.pmtiles` dans `/docker/appdata/tileserver/pmtiles/` *(extrait de https://download.mapterhorn.com/planet.pmtiles)*
  
  -  > cf [data/pmtiles/README.md](./data/pmtiles/README.md) pour les autres actions

---

### Tileserver-gl
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/tileserver-gl
    ```
  - Copier le contenu de `assets/tileserver-gl` dans `/docker/appdata/tileserver/tileserver-gl/`

---

### NGINX *(nginx-map-assets)*
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/nginx
    ```
  - Copier le contenu de `assets/nginx` dans `/docker/appdata/tileserver/nginx/` 

---

### Graphhopper
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/graphhopper/data
    ```
  - Copier le fichier `france-latest.osm.pbf` dans `/docker/appdata/tileserver/graphhopper/data/` *(issu de https://download.geofabrik.de/)*

---

### Photon
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/photon/data
    ```
  - Copier le répertoire `data` dans `/docker/appdata/tileserver/photon/` *(issu d'une instance photon-docker online)*

---

### Nominatim
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/nominatim/db
    ```
  - Utilisation du dataset de Graphhopper

---

### FONTS
  - Créer le path sur le host : 
    ```bash
    mkdir -p /docker/appdata/tileserver/fonts
    ```
  - Copier l'archive `fonts.tar.gz` sur le disque et l'extraire dans `/docker/appdata/tileserver/fonts/` avec la commande:
    ```bash
    tar -xzf fonts.tar.gz --strip-components=1 -C /docker/appdata/tileserver/fonts
    ```

---

### Overpass
  - Moteur de base de données
    - ```bash
      mkdir -p /docker/appdata/tileserver/overpass/{db,data}
      ```
    - Récupérer un dataset au format osm.bz2
    -  > cf [data/overpass/README.md](./data/overpass/README.md) pour les actions

  - Interface web  

    - Structure de dossier et comilation
      ```bash
      mkdir -p /docker/appdata/tileserver/overpass-turbo/html

      # Construire l'application via un conteneur temporaire
      docker run --rm -it \
        -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
        -v /docker/appdata/tileserver/overpass-turbo/html:/app \
        node:22-alpine sh -c "
        apk add --no-cache git && \
        corepack enable && \
        git config --global --add safe.directory /app && \
        git clone --depth 1 https://github.com/tyrasd/overpass-turbo.git /app && \
        cd /app && \
        
        # 1. On retire l'exclusion de leaflet pour qu'il soit bien traité par le build
        sed -i 's/exclude: \[\"leaflet\"\]/exclude: []/' vite.config.mts && \
        
        # 2. On ajoute L: 'leaflet' dans le plugin inject (juste avant $)
        sed -i \"s/\\\$: \\\"jquery\\\",/L: 'leaflet', \\\$: \\\"jquery\\\",/\" vite.config.mts && \
        
        # 3. On force quand même le global dans index.ts pour les vieux plugins
        sed -i \"1i import L from 'leaflet'; (window as any).L = L;\" js/index.ts && \
        
        pnpm install && \
        pnpm run build
      "
      ```

    - Modifier les sources compiler pour s'appuyer sur le Nominatim déployé en local (⚠️adapter l'ip)
      ```bash
      sudo find /docker/appdata/tileserver/overpass-turbo/html/dist -type f -exec sed -i 's|https://nominatim.openstreetmap.org|http://192.168.10.3:8891|g' {} +
      ```

    - Créer le fichier config.js (⚠️adapter l'ip) **🚧 FIXME**
      ```bash
      # Créer le fichier config.js
      nano /docker/appdata/tileserver/overpass-turbo/html/dist/config.js
      ```

      ```bash
      var settings = {
        overpass_server: "http://192.168.10.3:8894/api/",
        share_link: false,
        tileServer: "http://192.168.10.3:8897/styles/basic-preview/{z}/{x}/{y}.png",
        useLeaflet: true,
        coords_lat: 46.2276,
        coords_lon: 2.2137,
        zoom: 6
      };
      ```

---

- Exemples
  - Créer le path sur le host : `mkdir -p /docker/appdata/tileserver/examples`
  - Copier le contenu de `examples` dans `/docker/appdata/tileserver/examples/`  
  - 🚧 Adapter les ip dans : 🚧
    - maplibre/js/config.js
    - leaflet/test_tileserver-gl_mbtiles_leaflet.html
    ```bash
    sudo find /docker/appdata/tileserver/examples/ -type f -exec sed -i 's/192.168.10.3/192.168.xx.yy/g' {} +
    ```


---

- Gestion des droits:
  ```bash
  sudo chown -R administrateur:administrateur /docker/appdata/tileserver
  sudo chown -R 101:101 /docker/appdata/tileserver/fonts
  sudo chown -R 101:101 /docker/appdata/tileserver/examples
  sudo chmod -R 755 /docker/appdata/tileserver
  ```

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
