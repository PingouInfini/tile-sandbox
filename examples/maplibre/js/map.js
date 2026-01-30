// Initialisation PMTiles
if (typeof pmtiles !== 'undefined') {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
}

const SETTINGS = window.APP_STATE; // Défini dans le HTML
const schema = MAP_CONFIG.schemas[SETTINGS.mode];

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
            elevation: { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation, tileSize: 256 }
        },
        terrain: { source: "elevation", exaggeration: 0.1 },
        layers: [{ id: "background", type: "background", paint: { "background-color": "#f2efe9" } }]
    },
    maxZoom: 22
});

map.on('load', () => {
    const container = document.getElementById('controls-container');

    schema.layers.forEach(def => {
        const isVisible = userConfig[def.id]?.visible ?? true;
        const currentColor = userConfig[def.id]?.color ?? def.color;

        const layerDef = {
            "id": def.id,
            "source": "osm",
            "source-layer": def.source,
            "type": def.type,
            "minzoom": def.minzoom || 0,
            "layout": { "visibility": isVisible ? 'visible' : 'none' },
            "paint": {}
        };

        // Gestion du FILTRE (Correction Eau PMTiles)
        if (def.filter) layerDef.filter = def.filter;

        // Application des styles selon type
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
          // Configuration de base du texte
          layerDef.layout["text-font"] = ["Noto Sans Regular"];
          
          // Si c'est une étiquette de route (ergonomie avancée)
          if (def.isRoadLabel) {
              layerDef.layout["symbol-placement"] = "line";
              layerDef.layout["text-field"] = ["coalesce", ["get", "name"], ["get", "ref"]];
              layerDef.layout["text-rotation-alignment"] = "map";
              layerDef.layout["text-pitch-alignment"] = "map";
              layerDef.layout["text-letter-spacing"] = 0.05;
              layerDef.layout["text-size"] = [
                  "interpolate", ["linear"], ["zoom"],
                  13, 8,
                  16, 12
              ];
          } else {
              // Étiquette standard (Villes, POI)
              layerDef.layout["text-field"] = ["get", "name"];
              layerDef.layout["text-size"] = 12;
          }

          layerDef.paint = {
              "text-color": currentColor,
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5
          };
        }

        map.addLayer(layerDef);

        // --- UI ---
        const div = document.createElement('div');
        div.className = 'layer-control';
        div.innerHTML = `
            <input type="checkbox" ${isVisible ? 'checked' : ''}>
            <label title="Zoom min: ${def.minzoom || 0}">${def.desc}</label>
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
    });

    // Bouton Reset
    document.getElementById('reset-config').onclick = () => {
        if(confirm("Réinitialiser ?")) { localStorage.removeItem(schema.storageKey); location.reload(); }
    };
});