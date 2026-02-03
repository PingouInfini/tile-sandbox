# Graphhopper

### Récupération d'un jeu de données

Depuis `https://download.geofabrik.de/`

- Récupération des données France (~4.6Go)

    > A stocker dans `/docker/appdata/tileserver/graphhopper/data`

    ```
    wget https://download.geofabrik.de/europe/france-latest.osm.pbf \
    -O /docker/appdata/tileserver/graphhopper/data/france-latest.osm.pbf
    ```

### Tests

```
http://192.168.10.3:8895/api?q=Meudon
```