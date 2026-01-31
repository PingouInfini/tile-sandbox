# pmtiles

### Dataset

https://maps.protomaps.com/builds/

> 20260114.pmtiles
> 130Go

```
docker run --rm \
  -v /volume1/Partage/workspace/dted_pmtiles:/data \
  protomaps/go-pmtiles extract \
  https://download.mapterhorn.com/planet.pmtiles \
  /data/corse_elevation.pmtiles \
  --bbox=8.53,41.33,9.56,43.05
```

> --bbox=minLon,minLat,maxLon,maxLat

```
docker run --rm \
  -v /volume1/Partage/workspace/dted_pmtiles:/data \
  protomaps/go-pmtiles extract \
  https://download.mapterhorn.com/planet.pmtiles \
  /data/france_elevation.pmtiles s \ --bbox=-5.5,41.0,10.0,51.5
```

### Récupérer utilitaire pmtiles

```
wget https://github.com/protomaps/go-pmtiles/releases/download/v1.29.1/go-pmtiles_1.29.1_Linux_x86_64.tar.gz
tar xzf go-pmtiles_1.29.1_Linux_x86_64.tar.gz
chmod +x pmtiles
```

### Visualiser les metadata

```
./pmtiles show --metadata 20260114.pmtiles
```

### Convertir mbtiles -> pmtiles

```
./pmtiles convert INPUT.mbtiles OUTPUT.pmtiles
```

### Convertir pmtiles -> mbtiles

```
./pmtiles extract source.pmtiles output.mbtiles
```

### Utils

https://github.com/protomaps/PMTiles