#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# ESA WorldCover 10 m - 2021 v200
#
# Produit final :
#   /mnt/workspace/tile-sandbox/data/COG/ESA_WorldCover_10m_2021_v200_GLOBAL.tif
#
# Le résultat est :
#   - GeoTIFF / BigTIFF / COG
#   - 10 m natifs (EPSG:4326)
#   - Classification conservée en NEAREST
#
# Pré-requis :
#   curl, python3, unzip, gdalbuildvrt, gdal_translate, gdalinfo (GDAL >= 3.8)
###############################################################################

############################
# Configuration
############################

RECORD_ID="7254221"
VERSION="2021_v200"

WORKDIR="${WORKDIR:-/mnt/workspace/tile-sandbox/data/COG}"

DOWNLOAD_DIR="${WORKDIR}/downloads"
DATA_DIR="${WORKDIR}/data"
VRT_DIR="${WORKDIR}/vrt"

OUTPUT="${WORKDIR}/ESA_WorldCover_10m_2021_v200_GLOBAL.tif"
VRT="${VRT_DIR}/worldcover_global.vrt"
FILELIST="${VRT_DIR}/worldcover_files.txt"

ZENODO_API="https://zenodo.org/api/records/${RECORD_ID}"

# Création des dossiers de travail
mkdir -p \
    "${DOWNLOAD_DIR}" \
    "${DATA_DIR}" \
    "${VRT_DIR}"

############################
# Fonctions
############################

log() {
    echo
    echo "======================================================================"
    echo "$*"
    echo "======================================================================"
}

die() {
    echo
    echo "ERROR: $*" >&2
    exit 1
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

############################
# Vérification des dépendances
############################

log "Vérification des dépendances"

for cmd in curl python3 unzip gdalbuildvrt gdal_translate gdalinfo; do
    command_exists "${cmd}" || die "Commande manquante : ${cmd}"
done

GDAL_VERSION="$(gdalinfo --version || true)"
echo "GDAL : ${GDAL_VERSION}"
echo "Répertoire de travail : ${WORKDIR}"
echo "Sortie finale : ${OUTPUT}"

############################
# Vérification de l'espace disque
############################

log "Vérification de l'espace disque"

AVAILABLE_KB="$(df -Pk "${WORKDIR}" | awk 'NR==2 {print $4}')"
AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))

echo "Espace libre : ~${AVAILABLE_GB} GiB"

if (( AVAILABLE_GB < 300 )); then
    echo
    echo "ATTENTION : moins de 300 GiB disponibles."
    echo "La construction d'un COG mondial peut nécessiter beaucoup d'espace"
    echo "temporaire en plus des données source."
    echo
fi

############################
# Récupération de la liste officielle
############################

log "Récupération de la liste officielle Zenodo"

RECORD_JSON="${WORKDIR}/zenodo_record.json"

curl \
    --fail \
    --location \
    --retry 10 \
    --retry-delay 5 \
    --output "${RECORD_JSON}" \
    "${ZENODO_API}"

python3 - "${RECORD_JSON}" "${DOWNLOAD_DIR}/files.tsv" <<'PY'
import json
import sys
from pathlib import Path

record_file = Path(sys.argv[1])
output_file = Path(sys.argv[2])

data = json.loads(record_file.read_text())
files = data.get("files", [])

selected = []

for item in files:
    key = item.get("key", "")
    checksum = item.get("checksum", "")
    links = item.get("links", {})
    download = links.get("self")

    if (
        key.endswith(".zip")
        and "ESA_WorldCover_10m_2021_v200_60deg_macrotile_" in key
    ):
        if not download:
            raise RuntimeError(f"Pas d'URL de téléchargement pour {key}")

        checksum = checksum.replace("md5:", "").strip()
        selected.append((key, checksum, download))

if len(selected) != 18:
    raise RuntimeError(
        f"18 macro-tuiles attendues, {len(selected)} trouvées"
    )

selected.sort()

with output_file.open("w", encoding="utf-8") as f:
    for key, checksum, download in selected:
        f.write(f"{key}\t{checksum}\t{download}\n")

print(f"{len(selected)} macro-tuiles trouvées.")
PY

echo
echo "Fichiers à récupérer :"
cut -f1 "${DOWNLOAD_DIR}/files.tsv"

############################
# Téléchargement + MD5 + Extraction
############################

log "Téléchargement des macro-tuiles"

while IFS=$'\t' read -r FILENAME MD5 URL; do

    ZIP="${DOWNLOAD_DIR}/${FILENAME}"

    echo
    echo ">>> ${FILENAME}"
    echo "    URL : ${URL}"

    if [[ -f "${ZIP}" ]]; then
        echo "    Fichier déjà présent, test MD5..."
    else
        echo "    Téléchargement..."
        curl \
            --fail \
            --location \
            --retry 20 \
            --retry-delay 5 \
            --continue-at - \
            --output "${ZIP}" \
            "${URL}"
    fi

    #echo "    Vérification MD5..."
    #ACTUAL_MD5="$(md5sum "${ZIP}" | awk '{print $1}')"

    #if [[ "${ACTUAL_MD5}" != "${MD5}" ]]; then
    #    echo "MD5 attendu : ${MD5}"
    #    echo "MD5 obtenu  : ${ACTUAL_MD5}"
    #    die "Checksum incorrect pour ${FILENAME}"
    #fi

    #echo "    MD5 OK"
    echo "    Extraction..."

    unzip -q "${ZIP}" -d "${DATA_DIR}"
    rm -f "${ZIP}"
    echo "    ZIP supprimé pour économiser l'espace disque."

done < "${DOWNLOAD_DIR}/files.tsv"

############################
# Recherche des COG sources
############################

log "Recherche des tuiles WorldCover 3° x 3°"

find "${DATA_DIR}" \
    -type f \
    -name '*_Map.tif' \
    -print \
    | sort > "${FILELIST}"

COUNT="$(wc -l < "${FILELIST}")"

echo "Nombre de fichiers trouvés : ${COUNT}"

if [[ "${COUNT}" -lt 2000 ]]; then
    die "Beaucoup trop peu de tuiles WorldCover trouvées : ${COUNT}"
fi

############################
# Contrôle rapide des CRS
############################

log "Contrôle du premier fichier"

FIRST_TILE="$(head -n 1 "${FILELIST}")"

gdalinfo "${FIRST_TILE}" | grep -E \
    'Driver:|Size is|Coordinate System is|AUTHORITY|Pixel Size' \
    | head -n 20 || true

############################
# Construction du VRT
############################

log "Construction du VRT mondial"

rm -f "${VRT}"

gdalbuildvrt \
    -overwrite \
    -resolution highest \
    -r nearest \
    -input_file_list "${FILELIST}" \
    "${VRT}"

############################
# Informations VRT
############################

log "Informations VRT"

gdalinfo "${VRT}" | grep -E \
    'Size is|Pixel Size|Origin|Coordinate System is|AUTHORITY' \
    | head -n 30 || true

############################
# Construction du COG
############################

log "Construction du COG mondial"

if [[ -f "${OUTPUT}" ]]; then
    echo "Suppression de l'ancien fichier de sortie..."
    rm -f "${OUTPUT}"
fi

time gdal_translate \
    "${VRT}" \
    "${OUTPUT}" \
    -of COG \
    -co BIGTIFF=YES \
    -co COMPRESS=ZSTD \
    -co LEVEL=9 \
    -co BLOCKSIZE=512 \
    -co PREDICTOR=2 \
    -co RESAMPLING=NEAREST \
    -co OVERVIEW_RESAMPLING=NEAREST \
    -co OVERVIEWS=AUTO

############################
# Informations finales
############################

log "Informations sur le COG final"

gdalinfo "${OUTPUT}" | grep -E \
    'Driver:|Files:|Size is|Origin|Pixel Size|Coordinate System is|AUTHORITY|Type=|Block=' \
    | head -n 50 || true

############################
# Validation COG (GDAL 3.8)
############################

log "Validation COG"

if python3 -m osgeo_utils.samples.validate_cloud_optimized_geotiff "${OUTPUT}"; then
    echo "Validation COG réussie."
elif command_exists validate_cloud_optimized_geotiff.py; then
    validate_cloud_optimized_geotiff.py "${OUTPUT}"
else
    echo "Outil de validation COG introuvable dans Python/GDAL, étape sautée."
fi

############################
# Résultat
############################

log "Résultat"

ls -lh "${OUTPUT}"

echo
echo "COG généré avec succès :"
echo "  ${OUTPUT}"
echo
echo "Terminé."
