let routePoints = [
    { id: 1, value: '', coords: null },
    { id: 2, value: '', coords: null }
];
let activeStepPopup = null;

export function initRoute(map) {
    const btnAddPt = document.getElementById('add-point-btn');
    const btnCalc = document.getElementById('calc-route-btn');
    const btnClearRoute = document.getElementById('clear-route-btn');

    renderRouteInputs();

    if (btnAddPt) btnAddPt.onclick = () => {
        routePoints.push({ id: Date.now(), value: '', coords: null });
        renderRouteInputs();
    };

    if (btnCalc) btnCalc.onclick = () => calculateRoute(map);
    if (btnClearRoute) btnClearRoute.onclick = () => clearRoute(map);

    // Context Menu (Clic Droit) pour définir les points
    map.on('contextmenu', (e) => {
        const emptyPt = routePoints.find(p => !p.coords);
        
        if (emptyPt) {
            emptyPt.coords = [e.lngLat.lat, e.lngLat.lng]; 
            emptyPt.value = `${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`;
            renderRouteInputs();
            
            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
                .setLngLat(e.lngLat)
                .setHTML('<div style="padding:5px; color:#2c3e50; font-weight:bold;">📍 Point ajouté !</div>')
                .addTo(map);

            setTimeout(() => {
                popup.remove();
            }, 900);
        } else {
            alert("Tous les points sont remplis. Ajoutez une étape ou effacez.");
        }
    });
}

function renderRouteInputs() {
    const routeInputsContainer = document.getElementById('route-inputs');
    if (!routeInputsContainer) return;
    routeInputsContainer.innerHTML = '';
    
    routePoints.forEach((pt, index) => {
        const row = document.createElement('div');
        row.className = 'route-point-row';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = index === 0 ? "Départ" : (index === routePoints.length - 1 ? "Arrivée" : "Étape");
        input.value = pt.value;
        
        input.onchange = (e) => { 
            pt.value = e.target.value; 
            pt.coords = null; 
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

function calculateRoute(map) {
    const validPoints = routePoints.filter(p => p.coords);
    if (validPoints.length < 2) {
        alert("Veuillez définir au moins 2 points (Clic droit sur la carte pour remplir rapidement).");
        return;
    }

    const url = new URL(MAP_CONFIG.urls.graphhopper_api);
    validPoints.forEach(p => url.searchParams.append("point", `${p.coords[0]},${p.coords[1]}`));
    url.searchParams.append("profile", "car");
    url.searchParams.append("locale", "fr");
    url.searchParams.append("points_encoded", "false");
    url.searchParams.append("instructions", "true");

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.paths && data.paths.length > 0) {
                const path = data.paths[0];
                displayRouteOnMap(map, path.points); 
                displayInstructions(map, path, path.points.coordinates);
            } else {
                alert("Aucun itinéraire trouvé.");
            }
        })
        .catch(err => {
            console.error(err);
            alert("Erreur lors du calcul d'itinéraire.");
        });
}

function displayRouteOnMap(map, geojsonGeometry) {
    const sourceId = 'route-source';
    const layerId = 'route-layer';

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

    const bounds = new maplibregl.LngLatBounds();
    geojsonGeometry.coordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, { padding: 50 });
}

function displayInstructions(map, path, allCoordinates) {
    const container = document.getElementById('route-instructions');
    const summary = document.getElementById('route-summary');
    if (!container) return;

    const timeMin = Math.round(path.time / 60000);
    const distKm = (path.distance / 1000).toFixed(1);
    summary.innerHTML = `🏁 ${timeMin} min 📏 ${distKm} km`;

    container.innerHTML = '';
    
    path.instructions.forEach(instr => {
        const div = document.createElement('div');
        div.className = 'instruction-step';
        div.style.cursor = 'pointer';
        
        let icon = '➡';
        if (instr.sign === -2) icon = '↩'; 
        else if (instr.sign === -1) icon = '⬅'; 
        else if (instr.sign === 1) icon = '➡'; 
        else if (instr.sign === 2) icon = '↪'; 
        else if (instr.sign === 4) icon = '🏁'; 
        else if (instr.sign === 0) icon = '⬆'; 
        else if (instr.sign === 6) icon = 'o';

        div.innerHTML = `
            <span class="instruction-icon">${icon}</span> 
            <div style="flex:1;">${instr.text}</div> 
            <span style="color:#888; font-size:0.9em; white-space:nowrap;">(${Math.round(instr.distance)}m)</span>
        `;
        
        div.onclick = () => {
            const coordIndex = instr.interval[0];
            const stepCoord = allCoordinates[coordIndex];

            if (stepCoord) {
                map.flyTo({
                    center: stepCoord,
                    zoom: 17,
                    pitch: 40,
                    essential: true
                });

                if (activeStepPopup) activeStepPopup.remove();
                
                activeStepPopup = new maplibregl.Popup({ closeButton: false, className: 'instruction-popup' })
                    .setLngLat(stepCoord)
                    .setHTML(`<div style="font-size:12px; font-weight:bold;">${icon} Ici</div>`)
                    .addTo(map);
                
                document.querySelectorAll('.instruction-step').forEach(d => d.style.backgroundColor = 'transparent');
                div.style.backgroundColor = '#e8f0fe';
            }
        };

        div.onmouseover = () => div.style.backgroundColor = '#f5f5f5';
        div.onmouseout = () => {
            if (div.style.backgroundColor !== 'rgb(232, 240, 254)') div.style.backgroundColor = 'transparent';
        };

        container.appendChild(div);
    });
}

function clearRoute(map) {
    if (map.getLayer('route-layer')) map.removeLayer('route-layer');
    if (map.getSource('route-source')) map.removeSource('route-source');
    document.getElementById('route-instructions').innerHTML = '';
    document.getElementById('route-summary').innerHTML = '';
    
    routePoints = [{ id: 1, value: '', coords: null }, { id: 2, value: '', coords: null }];
    renderRouteInputs();
}