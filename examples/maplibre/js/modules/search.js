import { PLACE_ICONS } from './icons.js';

let debounceTimer;
let currentSearchMarker = null;

export function initSearch(map) {
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length < 3) {
            clearResults(resultsContainer);
            return;
        }
        debounceTimer = setTimeout(() => {
            searchPhoton(query, map, resultsContainer, searchInput);
        }, 300);
    });
    
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        if (query.length >= 3 && resultsContainer.children.length === 0) {
            searchPhoton(query, map, resultsContainer, searchInput);
        } else if (query.length >= 3 && resultsContainer.children.length > 0) {
             resultsContainer.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (searchInput && resultsContainer && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            clearResults(resultsContainer);
        }
    });
}

function clearResults(container) {
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
}

function searchPhoton(query, map, container, input) {
    // Utilise l'URL définie dans config.js
    const url = `${MAP_CONFIG.urls.photon_api}?q=${encodeURIComponent(query)}&limit=10&lang=fr`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Erreur réseau Photon");
            return response.json();
        })
        .then(data => {
            container.innerHTML = ''; 

            if (data.features && data.features.length > 0) {
                container.style.display = 'block';

                data.features.forEach(feature => {
                    const props = feature.properties;
                    const typeKey = props.osm_value || props.type;
                    const icon = PLACE_ICONS[typeKey] || PLACE_ICONS["default"];
                    const name = props.name || "Inconnu";
                    const context = [props.city, props.postcode, props.county].filter(Boolean).join(', ');
                    
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'autocomplete-item';
                    itemDiv.innerHTML = `
                         <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size: 1.2em;">${icon}</span>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: bold; color: #333;">${name}</span>
                                <span style="font-size: 0.85em; color: #666;">${context}</span>
                            </div>
                        </div>
                    `;
                    
                    itemDiv.onclick = () => {
                        const coords = feature.geometry.coordinates; 
                        
                        if (feature.properties.extent) {
                            const ext = feature.properties.extent;
                            map.fitBounds([[ext[0], ext[3]], [ext[2], ext[1]]], { padding: 50 });
                        } else {
                            map.flyTo({ center: coords, zoom: 14, essential: true });
                        }

                        if (currentSearchMarker) {
                            currentSearchMarker.remove();
                        }
                        
                        currentSearchMarker = new maplibregl.Marker({ color: "#FF0000" })
                            .setLngLat(coords)
                            .addTo(map);

                        input.value = props.name;
                        clearResults(container);
                    };

                    container.appendChild(itemDiv);
                });
            } else {
                clearResults(container);
            }
        })
        .catch(err => console.error("Erreur Photon :", err));
}