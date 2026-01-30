# pmtiles

### Dataset

https://maps.protomaps.com/builds/

> 20260114.pmtiles
> 130Go


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