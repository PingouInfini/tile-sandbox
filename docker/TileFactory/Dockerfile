FROM ubuntu:22.04

LABEL maintainer="PingouInfini 🐧♾️"
LABEL description="TileFactory - Édition Ultime avec support natif ECW"

# Variables d'environnement critiques pour la compilation et l'exécution
ENV DEBIAN_FRONTEND=noninteractive
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
ENV GDAL_DATA=/usr/local/share/gdal
ENV PROJ_LIB=/usr/share/proj

# 1. Dépendances système : Outils de compilation et librairies SIG de base
RUN apt-get update && apt-get install -y \
    build-essential cmake wget git pkg-config unzip \
    sqlite3 libsqlite3-dev zlib1g-dev libcurl4-openssl-dev \
    libtiff-dev libgeos-dev libproj-dev proj-data proj-bin \
    libjpeg-dev libpng-dev libwebp-dev libzstd-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# 2. LE SECRET : Compilation de libecwj2-3.3 (Librairie ECW Open Source)
RUN git clone https://github.com/rouault/libecwj2-3.3-builds.git && \
    cd libecwj2-3.3-builds/ && unzip -o -q libecwj2-3.3-2006-09-06.zip && \
    cd libecwj2-3.3/ && \
    ./configure --prefix=/usr/local && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# 3. LE MOTEUR : Compilation de GDAL 3.8.4 depuis les sources, lié à l'ECW
RUN wget https://github.com/OSGeo/gdal/releases/download/v3.8.4/gdal-3.8.4.tar.gz && \
    tar -xzf gdal-3.8.4.tar.gz && \
    cd gdal-3.8.4 && \
    mkdir build && cd build && \
    cmake .. \
        -DGDAL_USE_ECW=ON \
        -DECW_ROOT=/usr/local \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX=/usr/local && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# 4. LES VECTEURS : Compilation de Tippecanoe
RUN wget https://github.com/felt/tippecanoe/archive/refs/tags/2.79.0.tar.gz && \
    tar -xzf 2.79.0.tar.gz && \
    cd tippecanoe-2.79.0 && \
    make -j$(nproc) && \
    make install && \
    ldconfig

# 5. L'EMPAQUETEUR : Installation de PMTiles
RUN wget https://github.com/protomaps/go-pmtiles/releases/download/v1.30.2/go-pmtiles_1.30.2_Linux_x86_64.tar.gz && \
    tar xzf go-pmtiles_1.30.2_Linux_x86_64.tar.gz && \
    mv pmtiles /usr/local/bin/ && chmod +x /usr/local/bin/pmtiles && \
    rm go-pmtiles_1.30.2_Linux_x86_64.tar.gz

# 6. NETTOYAGE : On supprime les codes sources pour alléger l'image
RUN rm -rf /build

# 7. SCRIPTS : Configuration finale
COPY scripts/ /opt/tilefactory/
RUN chmod +x /opt/tilefactory/*.sh

WORKDIR /data

# Notre super entrypoint qui gère le mode daemon/bash
ENTRYPOINT ["/opt/tilefactory/entrypoint.sh"]