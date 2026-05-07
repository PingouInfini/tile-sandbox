#!/bin/bash
set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input.shp/geojson> <output.pmtiles>"
    exit 1
fi

INPUT_VECTOR=$1
OUTPUT_PMTILES=$2
BASENAME=$(basename "$INPUT_VECTOR" | cut -d. -f1)
TEMP_GEOJSON="${BASENAME}_temp.geojson"
TEMP_MBTILES="${BASENAME}.mbtiles"

echo "=== 1. Conversion vers GeoJSON WebMercator ==="
ogr2ogr -f GeoJSON -t_srs EPSG:3857 "$TEMP_GEOJSON" "$INPUT_VECTOR"

echo "=== 2. Génération du MBTiles avec Tippecanoe ==="
tippecanoe -o "$TEMP_MBTILES" -zg --drop-densest-as-needed "$TEMP_GEOJSON"

echo "=== 3. Conversion MBTiles -> PMTiles ==="
pmtiles convert "$TEMP_MBTILES" "$OUTPUT_PMTILES"

echo "=== 4. Nettoyage ==="
rm -f "$TEMP_GEOJSON" "$TEMP_MBTILES"

echo "✅ Transformation vectorielle terminée : $OUTPUT_PMTILES"