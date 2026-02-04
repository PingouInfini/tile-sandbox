// 1. Initialisation du protocole PMTiles
if (typeof pmtiles !== 'undefined') {
    const protocol = new pmtiles.Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
}

const SETTINGS = window.APP_STATE;
// On s'assure que le mode existe dans schemas, sinon fallback
const schema = MAP_CONFIG.schemas[SETTINGS.mode] || MAP_CONFIG.schemas['openmaptiles'];

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

// --- PRÉPARATION DYNAMIQUE DES SOURCES ---
const mapSources = {
    osm: {
        type: "vector",
        [SETTINGS.mode === 'protomaps' ? 'url' : 'tiles']: SETTINGS.sourceUrl,
        minzoom: 0, 
        maxzoom: 14
    }
};

// On n'ajoute le raster Paris que si on est en mode MBTiles
if (SETTINGS.mode === 'openmaptiles') {
    mapSources.paris_raster = { 
        type: 'raster', 
        tiles: MAP_CONFIG.urls.raster_paris, 
        tileSize: 256 
    };
}

// On n'ajoute les PMTiles (Elevation) que si on est en mode PMTiles
if (SETTINGS.mode === 'protomaps') {
    mapSources.terrain_corse = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 };
    mapSources.terrain_alpes = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 };
    mapSources.hill_corse = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_corse, tileSize: 256 };
    mapSources.hill_alpes = { type: "raster-dem", url: MAP_CONFIG.urls.pmtiles_elevation_alpes, tileSize: 256 };
}

// --- INITIALISATION DE LA CARTE ---
const map = new maplibregl.Map({
    container: 'map',
    center: SETTINGS.center,
    zoom: SETTINGS.zoom,
    style: {
        version: 8,
        glyphs: MAP_CONFIG.urls.fonts,
        sources: mapSources,
        // On n'active le terrain par défaut que si on est en mode PMTiles
        terrain: SETTINGS.mode === 'protomaps' ? { source: "terrain_corse", exaggeration: 0.1 } : undefined,
        layers: [
            { id: "background", type: "background", paint: { "background-color": "#f2efe9" } }
        ]
    },
    maxZoom: 22
});

// ==============================
// --- RECHERCHE & ITINÉRAIRE ---
// ==============================

const PLACE_ICONS = {
        // Administratif / Zones
        "city": "🏙️",
        "town": "🏘️",
        "village": "🏡",
        "suburb": " 🏠",
        "hamlet": "🏠",
        
        // Transport
        "station": "🚉",
        "bus_stop": "🚌",
        "aerodrome": "✈️",
        "airport": "✈️",
        "ferry_terminal": "⛴️",
        "halt": "🚉",
        "tram_stop": "🚋",
        
        // Routes / Adresses
        "highway": "🛣️",
        "street": "📍",
        "house": "🏠",
        "residential": "🏠",
        
        // Nature / Loisirs
        "park": "🌳",
        "forest": "🌲",
        "garden": "🌻",
        "water": "💧",
        "stream": "🌊",
        "lake": "🛶",
        "beach": "🏖️",
        "peak": "⛰️",
        
        // Services / Commerces
        "restaurant": "🍴",
        "fast_food": "🍴",
        "cafe": "☕",
        "bar": "🍺",
        "hotel": "🏨",
        "hospital": "🏥",
        "school": "🏫",
        "university": "🎓",
        "church": "⛪",
        "place_of_worship": "⛪",
        "supermarket": "🛒",
        "mall": "🛍️",
        "bank": "🏦",
        "atm": "🏧",
        "cinema": "🎬",
        "museum": "🏛️",
        "tourism": "📸",
        "attraction": "🎡",
        
        // Par défaut
        "default": "📍"
    };

// --- 1. GESTION DE LA RECHERCHE (PHOTON) ---
const searchInput = document.getElementById('search-input');
const resultsContainer = document.getElementById('search-results');
let debounceTimer;

// Fonction pour nettoyer les résultats
function clearResults() {
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
}

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        // On annule le précédent timer si l'utilisateur tape vite
        clearTimeout(debounceTimer);
        
        const query = e.target.value.trim();

        // Règle : Pas de recherche en dessous de 3 caractères
        if (query.length < 3) {
            clearResults();
            return;
        }

        // On lance la recherche après 300ms de pause (Debounce)
        debounceTimer = setTimeout(() => {
            searchPhoton(query);
        }, 300);
    });
    
    // Fermer si on clique dans le champ mais qu'il est vide
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 3 && resultsContainer.children.length > 0) {
            resultsContainer.style.display = 'block';
        }
    });
}

function searchPhoton(query) {
    // Construction de l'URL
    // Note : On encode la query pour gérer les espaces et caractères spéciaux
    const url = `${MAP_CONFIG.urls.photon_api}?q=${encodeURIComponent(query)}&limit=10&lang=fr`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Erreur réseau Photon");
            return response.json();
        })
        .then(data => {
            resultsContainer.innerHTML = ''; // On vide les anciens résultats

            if (data.features && data.features.length > 0) {
                // On affiche le conteneur
                resultsContainer.style.display = 'block';

                data.features.forEach(feature => {
                    const props = feature.properties;
                    
                    // 1. Déterminer l'icône
                    // On regarde la valeur OSM (ex: station) ou le type général (ex: city)
                    const typeKey = props.osm_value || props.type;
                    const icon = PLACE_ICONS[typeKey] || PLACE_ICONS["default"];

                    // 2. Créer l'élément visuel
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'autocomplete-item';
                    itemDiv.style.display = 'flex';
                    itemDiv.style.alignItems = 'center';
                    itemDiv.style.gap = '10px';

                    // 3. Construire le label avec l'icône et le contexte
                    const name = props.name || "Inconnu";
                    const context = [props.city, props.postcode, props.county].filter(Boolean).join(', ');

                    itemDiv.innerHTML = `
                        <span style="font-size: 1.2em;">${icon}</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold; color: #333;">${name}</span>
                            <span style="font-size: 0.85em; color: #666;">${context}</span>
                        </div>
                    `;
                    
                    // Gestion du clic sur un résultat
                    itemDiv.onclick = () => {
                        const coords = feature.geometry.coordinates; // [Lon, Lat] pour GeoJSON
                        
                        // 1. Zoom et centrage
                        if (feature.properties.extent) {
                            const ext = feature.properties.extent;
                            // Photon renvoie [minLon, maxLat, maxLon, minLat]
                            map.fitBounds([[ext[0], ext[3]], [ext[2], ext[1]]], { padding: 50 });
                        } else {
                            map.flyTo({
                                center: coords,
                                zoom: 14,
                                essential: true // Force l'animation
                            });
                        }

                        // 2. Marqueur temporaire
                        new maplibregl.Marker({ color: "#FF0000" })
                            .setLngLat(coords)
                            .addTo(map);

                        // 3. Mise à jour du champ texte et fermeture liste
                        searchInput.value = props.name;
                        clearResults();
                    };

                    resultsContainer.appendChild(itemDiv);
                });
            } else {
                // Pas de résultats
                clearResults();
            }
        })
        .catch(err => {
            console.error("Erreur Photon :", err);
            // Optionnel : Afficher "Erreur" dans la liste
        });
}

// Clic ailleurs ferme la liste
document.addEventListener('click', (e) => {
    // Si on clique en dehors du champ ET en dehors des résultats
    if (searchInput && resultsContainer && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        clearResults();
    }
});

// --- 2. GESTION DU CALCUL D'ITINÉRAIRE (GRAPH HOPPER) ---
const routeInputsContainer = document.getElementById('route-inputs');
let routePoints = [
    { id: 1, value: '', coords: null }, // Point A
    { id: 2, value: '', coords: null }  // Point B
];

function renderRouteInputs() {
    if (!routeInputsContainer) return;
    routeInputsContainer.innerHTML = '';
    routePoints.forEach((pt, index) => {
        const row = document.createElement('div');
        row.className = 'route-point-row';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = index === 0 ? "Départ" : (index === routePoints.length - 1 ? "Arrivée" : "Étape");
        input.value = pt.value;
        
        // Simple logique : si l'utilisateur change le texte manuellement, on reset les coords
        // (Idéalement, il faudrait aussi brancher l'autocomplete Photon sur ces inputs !)
        input.onchange = (e) => { 
            pt.value = e.target.value; 
            pt.coords = null; // Invalide les coords si on tape du texte sans passer par un geocodeur
            // Pour faire simple ici : on suppose que l'utilisateur entrera "lat,lon" ou qu'on clique sur la carte (voir plus bas)
        };

        row.appendChild(input);

        if (routePoints.length > 2) {
            const btn = document.createElement('button');
            btn.className = 'remove-point-btn';
            btn.textContent = '×';
            btn.onclick = () => {
                routePoints.splice(index, 1);
                renderRouteInputs();
            };
            row.appendChild(btn);
        }
        routeInputsContainer.appendChild(row);
    });
}

// Boutons UI Itinéraire
const btnAddPt = document.getElementById('add-point-btn');
if (btnAddPt) btnAddPt.onclick = () => {
    routePoints.push({ id: Date.now(), value: '', coords: null });
    renderRouteInputs();
};

const btnCalc = document.getElementById('calc-route-btn');
if (btnCalc) btnCalc.onclick = calculateRoute;

const btnClearRoute = document.getElementById('clear-route-btn');
if (btnClearRoute) btnClearRoute.onclick = clearRoute;

// --- Helper: Interaction Carte pour remplir les champs ---
// Clic droit sur la carte pour définir les points (simple et efficace)
map.on('contextmenu', (e) => {
    // Trouve le premier champ vide
    const emptyPt = routePoints.find(p => !p.coords);
    
    if (emptyPt) {
        // Mise à jour des données
        emptyPt.coords = [e.lngLat.lat, e.lngLat.lng]; 
        emptyPt.value = `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`;
        renderRouteInputs();
        
        // Création et affichage de la popup
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
            .setLngLat(e.lngLat)
            .setHTML('<div style="padding:5px; color:#2c3e50; font-weight:bold;">📍 Point ajouté !</div>')
            .addTo(map);

        // Disparition automatique après quelques millisecondes
        setTimeout(() => {
            popup.remove();
        }, 900);
        // ------------------------

    } else {
        alert("Tous les points sont remplis. Ajoutez une étape ou effacez.");
    }
});


function calculateRoute() {
    // Vérifier qu'on a bien des coordonnées pour tous les points
    const validPoints = routePoints.filter(p => p.coords);
    if (validPoints.length < 2) {
        alert("Veuillez définir au moins 2 points (Clic droit sur la carte pour remplir rapidement).");
        return;
    }

    // Construction URL GraphHopper
    // API attend: point=lat,lon&point=lat,lon&points_encoded=false...
    const url = new URL(MAP_CONFIG.urls.graphhopper_api);
    validPoints.forEach(p => url.searchParams.append("point", `${p.coords[0]},${p.coords[1]}`));
    url.searchParams.append("profile", "car");
    url.searchParams.append("locale", "fr");
    url.searchParams.append("points_encoded", "false"); // Important pour récupérer du GeoJSON directement
    url.searchParams.append("instructions", "true");

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.paths && data.paths.length > 0) {
                const path = data.paths[0];
                displayRouteOnMap(path.points); // path.points est un GeoJSON LineString car encoded=false
                displayInstructions(path, path.points.coordinates);
            } else {
                alert("Aucun itinéraire trouvé.");
            }
        })
        .catch(err => {
            console.error(err);
            alert("Erreur lors du calcul d'itinéraire.");
        });
}

function displayRouteOnMap(geojsonGeometry) {
    const sourceId = 'route-source';
    const layerId = 'route-layer';

    // Si la source existe déjà, on met à jour les données
    if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(geojsonGeometry);
    } else {
        map.addSource(sourceId, {
            type: 'geojson',
            data: geojsonGeometry
        });
        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': '#3b9ddd',
                'line-width': 5,
                'line-opacity': 0.8
            }
        });
    }

    // Zoomer sur l'itinéraire
    const bounds = new maplibregl.LngLatBounds();
    geojsonGeometry.coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 50 });
}

function displayInstructions(path, allCoordinates) {
    const container = document.getElementById('route-instructions');
    const summary = document.getElementById('route-summary');
    if (!container) return;

    // Résumé
    const timeMin = Math.round(path.time / 60000);
    const distKm = (path.distance / 1000).toFixed(1);
    summary.innerHTML = `🏁 ${timeMin} min 📏 ${distKm} km`;

    container.innerHTML = '';
    
    // Variable pour stocker la popup active (pour la fermer si on clique ailleurs)
    let activeStepPopup = null;

    path.instructions.forEach(instr => {
        const div = document.createElement('div');
        div.className = 'instruction-step';
        div.style.cursor = 'pointer'; // Indique que c'est cliquable
        
        // Icône
        let icon = '➡';
        if (instr.sign === -2) icon = '↩'; 
        else if (instr.sign === -1) icon = '⬅'; 
        else if (instr.sign === 1) icon = '➡'; 
        else if (instr.sign === 2) icon = '↪'; 
        else if (instr.sign === 4) icon = '🏁'; 
        else if (instr.sign === 0) icon = '⬆'; 
        else if (instr.sign === 6) icon = 'o'; // Rond-point

        div.innerHTML = `
            <span class="instruction-icon">${icon}</span> 
            <div style="flex:1;">${instr.text}</div> 
            <span style="color:#888; font-size:0.9em; white-space:nowrap;">(${Math.round(instr.distance)}m)</span>
        `;
        
        // --- LOGIQUE DU CLIC ---
        div.onclick = () => {
            // 1. Récupérer les coordonnées de l'instruction
            // instr.interval[0] est l'index du début de l'instruction dans la liste de points
            const coordIndex = instr.interval[0];
            const stepCoord = allCoordinates[coordIndex];

            if (stepCoord) {
                // 2. Voler vers le point
                map.flyTo({
                    center: stepCoord,
                    zoom: 17, // Zoom très proche pour bien voir le carrefour
                    pitch: 40, // Un peu d'inclinaison pour le style "GPS"
                    essential: true
                });

                // 3. Ajouter une popup temporaire pour confirmer le lieu
                if (activeStepPopup) activeStepPopup.remove();
                
                activeStepPopup = new maplibregl.Popup({ closeButton: false, className: 'instruction-popup' })
                    .setLngLat(stepCoord)
                    .setHTML(`<div style="font-size:12px; font-weight:bold;">${icon} Ici</div>`)
                    .addTo(map);
                
                // Highlight visuel dans la liste (optionnel)
                document.querySelectorAll('.instruction-step').forEach(d => d.style.backgroundColor = 'transparent');
                div.style.backgroundColor = '#e8f0fe';
            }
        };
        // -----------------------

        // Effet Hover CSS via JS
        div.onmouseover = () => div.style.backgroundColor = '#f5f5f5';
        div.onmouseout = () => {
            // On garde le fond bleu si c'est l'élément actif, sinon blanc
            if (div.style.backgroundColor !== 'rgb(232, 240, 254)') div.style.backgroundColor = 'transparent';
        };

        container.appendChild(div);
    });
}

function clearRoute() {
    if (map.getLayer('route-layer')) map.removeLayer('route-layer');
    if (map.getSource('route-source')) map.removeSource('route-source');
    document.getElementById('route-instructions').innerHTML = '';
    document.getElementById('route-summary').innerHTML = '';
    
    // Reset inputs
    routePoints = [{ id: 1, value: '', coords: null }, { id: 2, value: '', coords: null }];
    renderRouteInputs();
}

// Initialiser les inputs au démarrage
renderRouteInputs();


// ==================================
// --- FIN RECHERCHE & ITINÉRAIRE ---
// ==================================


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