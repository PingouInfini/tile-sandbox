// 1. Initialisation du protocole PMTiles
if (typeof pmtiles !== 'undefined') {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
}

const SETTINGS = window.APP_STATE;
const schema = MAP_CONFIG.schemas[SETTINGS.mode];

// --- GESTION DU STOCKAGE ---
function getSavedConfig() {
    const saved = localStorage.getItem(schema.storageKey);
    return saved ? JSON.parse(saved) : {};
}

function saveToStorage(layerId, property, value) {
    const config = getSavedConfig();
    if (!config[layerId]) config[layerId] = {};
    config[layerId][property] = value;
    localStorage.setItem(schema.storageKey, JSON.stringify(config));
}

const userConfig = getSavedConfig();

// --- INITIALISATION DE LA CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    center: SETTINGS.center,
    zoom: SETTINGS.zoom,
    style: {
        version: 8,
        glyphs: MAP_CONFIG.urls.fonts,
        sources: {
            osm: {
                type: "vector",
                [SETTINGS.mode === 'protomaps' ? 'url' : 'tiles']: SETTINGS.sourceUrl,
                minzoom: 0,
                maxzoom: 14
            },
            // Source Raster (uniquement pour MBTiles/Paris)
            paris_raster: { type: 'raster', tiles: MAP_CONFIG.urls.raster_paris, tileSize: 256 },
            // Sources Elevation (pour PMTiles)
            terrain_corse: { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 },
            terrain_alpes: { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 },
            hill_corse: { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 },
            hill_alpes: { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 }
        },
        // On n'active le terrain par défaut que si on est en mode PMTiles
        terrain: SETTINGS.mode === 'protomaps' ? { source: "terrain_corse", exaggeration: 0.1 } : undefined,
        layers: [
            { id: "background", type: "background", paint: { "background-color": "#f2efe9" } }
        ]
    },
    maxZoom: 22
});

// --- LOGIQUE UNE FOIS LA CARTE CHARGÉE ---
map.on('load', () => {
    const container = document.getElementById('controls-container');
    const typeOrder = { 'fill': 1, 'line': 2, 'fill-extrusion': 3, 'symbol': 4 };

    // 1. Préparation de la liste unique de couches à injecter
    const allLayers = [
        ...schema.layers.map(l => ({ ...l, isExtra: false, order: typeOrder[l.type] })),
        ...schema.extraLayers.map(l => ({ ...l, isExtra: true }))
    ].sort((a, b) => a.order - b.order);

    // 2. Injection dans MapLibre
    allLayers.forEach(def => {
        let layerDef;

        if (def.isExtra) {
            // Couches spéciales (Raster, Hillshade)
            layerDef = {
                id: def.id,
                type: def.type,
                source: def.source,
                minzoom: def.minzoom || 0,
                layout: { visibility: 'visible' },
                paint: def.paint || {}
            };
        } else {
            // Couches vectorielles standards
            const isVisible = userConfig[def.id]?.visible ?? true;
            const currentColor = userConfig[def.id]?.color ?? def.color;

            layerDef = {
                id: def.id,
                source: "osm",
                "source-layer": def.source,
                type: def.type,
                minzoom: def.minzoom || 0,
                layout: { visibility: isVisible ? 'visible' : 'none' },
                paint: {}
            };

            if (def.filter) layerDef.filter = def.filter;
            
            // Logique de style selon le type (fill, line, etc.)
            if (def.type === 'fill') layerDef.paint["fill-color"] = currentColor;
            else if (def.type === 'line') {
                layerDef.paint["line-color"] = currentColor;
                layerDef.paint["line-width"] = ["interpolate", ["linear"], ["zoom"], 5, 0.5, 15, 3];
            }
            else if (def.type === 'fill-extrusion') {
                layerDef.paint = {
                    "fill-extrusion-color": currentColor,
                    "fill-extrusion-height": ["coalesce", ["get", def.hField], 5],
                    "fill-extrusion-base": ["coalesce", ["get", def.bField], 0],
                    "fill-extrusion-opacity": 0.8
                };
            }
            else if (def.type === 'symbol') {
                layerDef.layout["text-font"] = ["Noto Sans Regular"];
                layerDef.layout["text-field"] = def.isRoadLabel ? ["coalesce", ["get", "name"], ["get", "ref"]] : ["get", "name"];
                layerDef.layout["text-size"] = def.isRoadLabel ? ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 12] : 12;
                if (def.isRoadLabel) {
                    layerDef.layout["symbol-placement"] = "line";
                    layerDef.layout["text-rotation-alignment"] = "map";
                }
                layerDef.paint = { "text-color": currentColor, "text-halo-color": "#ffffff", "text-halo-width": 1.5 };
            }

            // Création de l'UI uniquement pour les couches standards
            createLayerUI(def, isVisible, currentColor, container);
        }

        map.addLayer(layerDef);
    });
});

// --- HELPER UI ---
function createLayerUI(def, isVisible, currentColor, container) {
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'layer-control';
    div.innerHTML = `
        <input type="checkbox" ${isVisible ? 'checked' : ''}>
        <label>${def.desc}</label>
        <input type="color" value="${currentColor}">
    `;
    div.querySelector('input[type="checkbox"]').onchange = (e) => {
        map.setLayoutProperty(def.id, 'visibility', e.target.checked ? 'visible' : 'none');
        saveToStorage(def.id, 'visible', e.target.checked);
    };
    div.querySelector('input[type="color"]').oninput = (e) => {
        const prop = (def.type === 'fill') ? 'fill-color' : (def.type === 'line') ? 'line-color' : (def.type === 'symbol') ? 'text-color' : 'fill-extrusion-color';
        map.setPaintProperty(def.id, prop, e.target.value);
        saveToStorage(def.id, 'color', e.target.value);
    };
    container.appendChild(div);
}

// --- ÉCOUTEURS D'ÉVÉNEMENTS (Hors boucle Load pour la stabilité) ---

// 1. Bouton Reset (Fonctionne sur les deux fichiers)
const btnReset = document.getElementById('reset-config');
if (btnReset) {
    btnReset.onclick = () => {
        if(confirm("Réinitialiser les réglages de cette page ?")) { 
            localStorage.removeItem(schema.storageKey); 
            location.reload(); 
        }
    };
}

// 2. Toggle Raster Paris (Uniquement page MBTiles)
const rasterCheck = document.getElementById('toggle-raster');
if (rasterCheck) {
    rasterCheck.onchange = (e) => {
        if (map.getLayer('paris-layer')) {
            map.setLayoutProperty('paris-layer', 'visibility', e.target.checked ? 'visible' : 'none');
        }
    };
}

// 3. Toggle Hillshade (Uniquement page PMTiles)
const hillCheck = document.getElementById('toggle-hillshade');
if (hillCheck) {
    hillCheck.onchange = (e) => {
        const visibility = e.target.checked ? 'visible' : 'none';
        ['hillshade-corse', 'hillshade-alpes'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
        });
    };
}

// 4. Auto-Swap Terrain (Uniquement mode PMTiles)
map.on('moveend', () => {
    if (SETTINGS.mode !== 'protomaps') return;
    const center = map.getCenter();
    const targetSource = (center.lat > 44) ? "terrain_alpes" : "terrain_corse";
    if (map.getTerrain()?.source !== targetSource) {
        map.setTerrain({ source: targetSource, exaggeration: 0.1 });
    }
});