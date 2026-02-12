const SETTINGS = window.APP_STATE;
// Sélectionne le schéma 'protomaps' ou 'openmaptiles' selon la page
const schema = MAP_CONFIG.schemas[SETTINGS.mode] || MAP_CONFIG.schemas['openmaptiles'];

import { ViewshedTool } from './intervisibilite.js';

// --- STORAGE HELPER ---
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

export function initLayers(map) {
    const userConfig = getSavedConfig();

    map.on('load', () => {
        const container = document.getElementById('controls-container');
        const typeOrder = { 'fill': 1, 'line': 2, 'fill-extrusion': 3, 'symbol': 4 };

        // 1. Fusionner et trier les couches (Extra + Standard)
        const allLayers = [
            ...schema.layers.map(l => ({ ...l, isExtra: false, order: typeOrder[l.type] || 10 })),
            ...schema.extraLayers.map(l => ({ ...l, isExtra: true }))
        ].sort((a, b) => a.order - b.order);

        // 2. Ajouter les couches à la carte
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
                // Couches vectorielles standard (OSM)
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
                
                // Style dynamique
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
                    
                    // Gestion noms de routes vs noms de lieux
                    if (def.isRoadLabel) {
                        layerDef.layout["text-field"] = ["coalesce", ["get", "name:fr"], ["get", "name"], ["get", "ref"]];
                        layerDef.layout["symbol-placement"] = "line";
                        layerDef.layout["text-rotation-alignment"] = "map";
                        layerDef.layout["text-size"] = ["interpolate", ["linear"], ["zoom"], 13, 8, 16, 12];
                    } else {
                        layerDef.layout["text-field"] = ["coalesce", ["get", "name:fr"], ["get", "name"]];
                        layerDef.layout["text-size"] = 12;
                    }

                    layerDef.paint = { 
                        "text-color": currentColor, 
                        "text-halo-color": "#ffffff", 
                        "text-halo-width": 1.5 
                    };
                }

                // UI seulement pour les couches configurables
                createLayerUI(map, def, isVisible, currentColor, container);
            }

            map.addLayer(layerDef);
        });
        // --- INITIALISATION DE L'OUTIL D'INTERVISIBILITÉ ---
        const viewshed = new ViewshedTool(map);
        
        const btnViewshed = document.getElementById('btn-viewshed');
        if (btnViewshed) {
            btnViewshed.onclick = () => viewshed.toggle();
        }

        // On écoute le clic sur la carte
        map.on('click', (e) => {
            if (viewshed.active) {
                viewshed.onClick(e);
            }
        })        
    });

    // 3. Configurer les écouteurs d'événements globaux (Reset, Toggles spécifiques)
    setupLayerControls(map, schema);
}

function createLayerUI(map, def, isVisible, currentColor, container) {
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'layer-control';
    div.innerHTML = `
        <input type="checkbox" ${isVisible ? 'checked' : ''}>
        <label>${def.desc}</label>
        <input type="color" value="${currentColor}">
    `;
    
    // Toggle Visibilité
    div.querySelector('input[type="checkbox"]').onchange = (e) => {
        map.setLayoutProperty(def.id, 'visibility', e.target.checked ? 'visible' : 'none');
        saveToStorage(def.id, 'visible', e.target.checked);
    };

    // Changement Couleur
    div.querySelector('input[type="color"]').oninput = (e) => {
        const prop = (def.type === 'fill') ? 'fill-color' 
                   : (def.type === 'line') ? 'line-color' 
                   : (def.type === 'symbol') ? 'text-color' 
                   : 'fill-extrusion-color';
        map.setPaintProperty(def.id, prop, e.target.value);
        saveToStorage(def.id, 'color', e.target.value);
    };
    container.appendChild(div);
}

function setupLayerControls(map, schema) {
    // Bouton Reset
    const btnReset = document.getElementById('reset-config');
    if (btnReset) {
        btnReset.onclick = () => {
            if(confirm("Réinitialiser les réglages de cette page ?")) { 
                localStorage.removeItem(schema.storageKey); 
                location.reload(); 
            }
        };
    }

    // Toggle Raster (MBTiles) : id 'toggle-raster' -> contrôle 'paris-layer'
    const rasterCheck = document.getElementById('toggle-raster');
    if (rasterCheck) {
        rasterCheck.onchange = (e) => {
            if (map.getLayer('paris-layer')) {
                map.setLayoutProperty('paris-layer', 'visibility', e.target.checked ? 'visible' : 'none');
            }
        };
    }

    // Toggle Hillshade (PMTiles) : id 'toggle-hillshade' -> contrôle 'hillshade-corse' & 'hillshade-alpes'
    const hillCheck = document.getElementById('toggle-hillshade');
    if (hillCheck) {
        hillCheck.onchange = (e) => {
            const visibility = e.target.checked ? 'visible' : 'none';
            ['hillshade-corse', 'hillshade-alpes'].forEach(id => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
            });
        };
    }
}