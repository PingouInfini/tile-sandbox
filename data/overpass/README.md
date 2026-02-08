# Overpass

### Dataset Back

- A partir d'un fichier .osm.pbf

cf [../graphhopper/README.md](../graphhopper/README.md) pour la récupération de fichiers .osm.pbf

- Conversion en archive bz2

> [osmium-cat](https://docs.osmcode.org/osmium/latest/osmium-cat.html)

```
docker run --rm -v /docker/appdata/tileserver/graphhopper/data:/data iboates/osmium:latest cat -o /data/france-latest.osm.bz2 /data/france-latest.osm.pbf
```

### Tests

- Cafés à Monaco

<http://192.168.10.3:8894/api/interpreter?data=[out:json];node[%22amenity%22=%22cafe%22](43.72,7.40,43.76,7.44);out;>

- Banques à Monaco

<http://192.168.10.3:8894/api/interpreter?data=[out:json];node[%22amenity%22=%22bank%22](43.72,7.40,43.76,7.44);out;>
