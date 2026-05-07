#!/bin/bash
set -e

INPUT=$1
OUTPUT=$2

if [[ -z "$INPUT" || -z "$OUTPUT" ]]; then
    echo "Usage: raster <input.ecw/tif> <output.pmtiles>"
    exit 1
fi

EXT="${INPUT##*.}"
BASENAME=$(basename "$INPUT" ."$EXT")
TEMP_TIF="reprojected_${BASENAME}.tif"
TEMP_MBTILES="temp_${BASENAME}.mbtiles"

# Étape 1 : Reprojection si nécessaire ou optimisation du TIFF
if [[ "$EXT" == "ecw" ]]; then
    echo "--- Conversion ECW -> GeoTIFF 3857 ---"
    gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS "$INPUT" "$TEMP_TIF"
else
    echo "--- Optimisation GeoTIFF (Censure SRC si déjà 3857) ---"
    gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS "$INPUT" "$TEMP_TIF"
fi

# Étape 2 : Création MBTiles (JPEG pour imagerie)
echo "--- Création MBTiles (JPEG 75%) ---"
gdal_translate "$TEMP_TIF" "$TEMP_MBTILES" -of MBTILES -co TILE_FORMAT=JPEG -co QUALITY=75 -co MINZOOM=0 -co MAXZOOM=18 -co ZOOM_LEVEL_STRATEGY=UPPER

# Étape 3 : Pyramide
echo "--- Génération de la pyramide ---"
gdaladdo -r average "$TEMP_MBTILES" 2 4 8 16 32 64 128 256 512 1024 2048 4096 8192 16384 32768 65536 131072 262144

# Étape 4 : Fix metadata
echo "--- Correction SQL ---"
sqlite3 "$TEMP_MBTILES" "UPDATE metadata SET value='0' WHERE name='minzoom';"

# Étape 5 : Conversion finale
echo "--- Conversion PMTiles ---"
pmtiles convert "$TEMP_MBTILES" "$OUTPUT"

# Nettoyage
rm -f "$TEMP_TIF" "$TEMP_MBTILES"
echo "✅ Terminé : $OUTPUT"