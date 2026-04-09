# pmtiles

### Dataset

https://maps.protomaps.com/builds/

> 20260114.pmtiles
> 130Go

---

### Overture

- Rebuild de la version pour linux/amd64

  ```bash
  git clone https://github.com/overturemaps/overture-tiles.git
  cd overture-tiles

  docker build -t overture-tiles:local .
  docker tag overture-tiles:local pingouinfinihub/overture-tiles:local
  docker push pingouinfinihub/overture-tiles:local
  ```

- Téléchargement pmtiles

  ```bash
  docker run --rm   -v $(pwd):/data   -e RELEASE='2026-03-18.0'   -e OUTPUT='noop'   -e THEME='places'   -e BBOX='2.2,48.7,2.5,48.9'   -e SKIP_UPLOAD='true'   pingouinfinihub/overture-tiles:local
  ```

  avec :
  - `RELEASE` → version des données Overture : https://docs.overturemaps.org/release-calendar/
  - `THEME=places` → Theme a processer (base, transportation, buildings, addresses, places, ou divisions)
  - `BBOX` → ici autour de Paris
  - `OUTPUT='noop'` → valeur bidon, ignorée grâce à SKIP_UPLOAD
  - `-v $(pwd):/data` → pour récupérer les fichiers générés

- Récupérer plusieurs thèmes:
  ```bash
  for theme in base transportation buildings addresses places divisions; do docker run --rm -v $(pwd):/data -e RELEASE='2026-03-18.0' -e OUTPUT='noop' -e THEME="$theme" -e BBOX='2.2,48.7,2.5,48.9' -e SKIP_UPLOAD='true' pingouinfinihub/overture-tiles:local; done
  ```
---

### Dataset elevation

https://mapterhorn.com/data-access/

```bash
docker run --rm \
  -v /volume1/Partage/workspace/dted_pmtiles:/data \
  protomaps/go-pmtiles extract \
  https://download.mapterhorn.com/planet.pmtiles \
  /data/corse_elevation.pmtiles \
  --bbox=8.53,41.33,9.56,43.05
```

> --bbox=minLon,minLat,maxLon,maxLat

```bash
docker run --rm \
  -v /volume1/Partage/workspace/dted_pmtiles:/data \
  protomaps/go-pmtiles extract \
  https://download.mapterhorn.com/planet.pmtiles \
  /data/france_elevation.pmtiles s \ --bbox=-5.5,41.0,10.0,51.5
```

- Combine the extracts into a single archive

```bash
pmtiles merge 1.pmtiles 2.pmtiles merged.pmtiles
```

### Récupérer utilitaire pmtiles

```bash
wget https://github.com/protomaps/go-pmtiles/releases/download/v1.29.1/go-pmtiles_1.29.1_Linux_x86_64.tar.gz
tar xzf go-pmtiles_1.29.1_Linux_x86_64.tar.gz
chmod +x pmtiles
```

### Visualiser les metadata

```bash
./pmtiles show --metadata 20260114.pmtiles
```

### Convertir mbtiles -> pmtiles

```bash
./pmtiles convert INPUT.mbtiles OUTPUT.pmtiles
```

### Convertir pmtiles -> mbtiles

```bash
./pmtiles extract source.pmtiles output.mbtiles
```

### Récupérer utilitaire tippecanoe

```bash
sudo dnf install -y gcc gcc-c++ make git sqlite-devel zlib-devel
git clone https://github.com/mapbox/tippecanoe.git
cd tippecanoe
make -j$(nproc)
sudo make install
tippecanoe --version
```

### Utils

https://github.com/protomaps/PMTiles