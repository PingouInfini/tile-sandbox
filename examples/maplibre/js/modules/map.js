const SETTINGS = window.APP_STATE;

export function initMap() {
    // 1. Initialisation du protocole PMTiles si la lib est chargée
    if (typeof pmtiles !== 'undefined') {
        const protocol = new pmtiles.Protocol();
        maplibregl.addProtocol("pmtiles", protocol.tile);
    }

    // --- PRÉPARATION DE LA SOURCE PRINCIPALE (OSM) ---
    // Adaptation dynamique selon si l'URL est un tableau (MBTiles) ou une string pmtiles:// (Protomaps)
    const osmSourceConfig = {
        type: "vector",
        minzoom: 0, 
        maxzoom: 14
    };

    if (SETTINGS.mode === 'protomaps') {
        osmSourceConfig.url = SETTINGS.sourceUrl; // pmtiles://...
        osmSourceConfig.attribution = '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>';
    } else {
        osmSourceConfig.tiles = SETTINGS.sourceUrl; // ["http://..."]
        osmSourceConfig.attribution = '© <a href="https://openstreetmap.org">OpenStreetMap</a>';
    }

    const mapSources = {
        osm: osmSourceConfig
    };

    // --- SOURCES SUPPLÉMENTAIRES SELON MODE ---
    
    // Mode MBTiles (Raster Paris)
    if (SETTINGS.mode === 'openmaptiles') {
        mapSources.paris_raster = { 
            type: 'raster', 
            tiles: MAP_CONFIG.urls.raster_paris, 
            tileSize: 256 
        };
    }

    // Mode PMTiles (Terrain / Elevation)
    if (SETTINGS.mode === 'protomaps') {
        mapSources.terrain_corse = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 };
        mapSources.terrain_alpes = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 };
        mapSources.hill_corse = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 };
        mapSources.hill_alpes = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 };
    }

    // --- CRÉATION DE LA CARTE ---
    const map = new maplibregl.Map({
        container: 'map',
        center: SETTINGS.center,
        zoom: SETTINGS.zoom,
        style: {
            version: 8,
            glyphs: MAP_CONFIG.urls.fonts,
            sources: mapSources,
            // Terrain actif par défaut uniquement en PMTiles
            terrain: SETTINGS.mode === 'protomaps' ? { source: "terrain_corse", exaggeration: 0.1 } : undefined,
            layers: [
                { id: "background", type: "background", paint: { "background-color": "#f2efe9" } }
            ]
        },
        maxZoom: 22
    });

    map.addControl(new maplibregl.NavigationControl({
        showCompass: true, 
        showZoom: true, 
        visualizePitch: true 
    }), 'top-right');

    // --- LOGIQUE AUTO-SWAP TERRAIN (PMTiles uniquement) ---
    map.on('moveend', () => {
        if (SETTINGS.mode !== 'protomaps') return;
        
        const center = map.getCenter();
        // Logique simple : au nord du 44ème parallèle -> Alpes, sinon Corse
        const targetSource = (center.lat > 44) ? "terrain_alpes" : "terrain_corse";
        
        const currentTerrain = map.getTerrain();
        if (!currentTerrain || currentTerrain.source !== targetSource) {
            map.setTerrain({ source: targetSource, exaggeration: 0.1 });
        }
    });

    return map;
}