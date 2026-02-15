// js/modules/intervisibilite.js

export class ViewshedTool {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.calculating = false;
        this.abortController = null; // Pour annuler un calcul en cours
        this.center = null;
        this.marker = null;
        
        // --- CONFIGURATION ---
        this.radius = 500; 
        this.observerHeight = 2.0; // Hauteur des yeux
        this.numRays = 180;        // 180 rayons suffisent souvent (1 tous les 2°)
        this.precision = 4;        // Pas d'échantillonnage (mètres). Plus petit = plus précis mais lent.
        
        // Calques à considérer comme obstacles visuels (Bâtiments)
        // Note: queryRenderedFeatures ne marche que sur ce qui est AFFICHÉ à l'écran.
        this.buildingLayers = ['building', 'buildings-3d', 'building-extrusion'];

        this.initLayers();
        this.bindUI();
    }

    bindUI() {
        const slider = document.getElementById('range-radius');
        const radiusDisplay = document.getElementById('radius-val');
        
        if (slider) {
            slider.oninput = (e) => {
                this.radius = parseInt(e.target.value);
                if (radiusDisplay) radiusDisplay.innerText = this.radius;
                // On ne relance pas le calcul automatiquement s'il est lourd, 
                // on attend un clic ou on le fait en debounce long si besoin.
            };
        }
    }

    initLayers() {
        // 1. Source Base (Zone d'étude - Disque Rouge)
        if(!this.map.getSource('viewshed-base')) {
            this.map.addSource('viewshed-base', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        
        // 2. Source Result (Zone visible - Polygone Vert)
        if(!this.map.getSource('viewshed-result')) {
            this.map.addSource('viewshed-result', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }

        // CALQUE ROUGE (Zone théorique)
        if(!this.map.getLayer('layer-viewshed-red')) {
            this.map.addLayer({
                id: 'layer-viewshed-red',
                type: 'fill',
                source: 'viewshed-base',
                paint: { 
                    'fill-color': '#e74c3c', 
                    'fill-opacity': 0.15,
                    'fill-outline-color': '#c0392b'
                }
            });
        }

        // CALQUE VERT (Zone visible)
        if(!this.map.getLayer('layer-viewshed-green')) {
            this.map.addLayer({
                id: 'layer-viewshed-green',
                type: 'fill',
                source: 'viewshed-result',
                paint: { 
                    'fill-color': '#00ff00', 
                    'fill-opacity': 0.5,
                    'fill-outline-color': '#27ae60' 
                }
            });
        }
    }

    toggle() {
        this.active = !this.active;
        
        // Si on désactive, on nettoie tout
        if (!this.active) {
            this.reset();
            if (this.calculating) {
                this.abortController.abort(); // Arrêter le calcul en cours
                this.calculating = false;
            }
        }

        this.updateUIButton();
    }

    updateUIButton(progress = null) {
        const btn = document.getElementById('btn-viewshed');
        if (!btn) return;

        if (this.active) {
            this.map.getCanvas().style.cursor = 'crosshair';
            btn.classList.add('active-tool');
            
            if (this.calculating) {
                btn.style.backgroundColor = '#f39c12'; // Orange pendant le calcul
                btn.innerHTML = progress ? `⏳ ${progress}%` : '⏳ Calcul...';
            } else {
                btn.style.backgroundColor = '#e74c3c'; // Rouge pour arrêter
                btn.innerHTML = '❌ Arrêter';
            }
        } else {
            this.map.getCanvas().style.cursor = '';
            btn.classList.remove('active-tool');
            btn.style.backgroundColor = '';
            btn.innerHTML = '🔭 Calculer Viewshed';
        }
    }

    reset() {
        if (this.marker) this.marker.remove();
        this.center = null;
        this.map.getSource('viewshed-base').setData({ type: 'FeatureCollection', features: [] });
        this.map.getSource('viewshed-result').setData({ type: 'FeatureCollection', features: [] });
        document.getElementById('los-result').innerText = "";
    }

    onClick(e) {
        if (!this.active || this.calculating) return; // Évite double clic pendant calcul

        this.center = e.lngLat;
        
        // Marker
        if (this.marker) this.marker.remove();
        this.marker = new maplibregl.Marker({ color: "#2980b9" })
            .setLngLat(this.center)
            .addTo(this.map);

        this.startAsyncCalculation();
    }

    // --- LE CŒUR DU SYSTÈME ASYNCHRONE ---
    async startAsyncCalculation() {
        this.calculating = true;
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        
        this.updateUIButton(0);
        document.getElementById('los-result').innerText = "Initialisation...";

        // 1. Dessiner la zone rouge (feedback immédiat)
        const redCircle = this.createCircleGeoJSON(this.center, this.radius);
        this.map.getSource('viewshed-base').setData(redCircle);

        // Données initiales
        const startElev = (this.map.queryTerrainElevation(this.center) || 0) + this.observerHeight;
        const vertices = [];
        
        // Facteurs de conversion (approximation locale)
        const latRad = this.center.lat * Math.PI / 180;
        const metersPerDegLng = 111320 * Math.cos(latRad);
        const metersPerDegLat = 110574;

        try {
            let raysCompleted = 0;
            
            // On lance le générateur de rayons
            // Cela permet de rendre la main au navigateur entre chaque paquet de rayons
            const generator = this.rayGenerator(startElev, metersPerDegLng, metersPerDegLat);

            for await (const vertex of generator) {
                if (signal.aborted) throw new Error("Annulé par utilisateur");
                
                vertices.push(vertex);
                raysCompleted++;

                // Mise à jour de l'UI tous les 10 rayons
                if (raysCompleted % 10 === 0) {
                    const pct = Math.round((raysCompleted / this.numRays) * 100);
                    this.updateUIButton(pct);
                }
            }

            // Fermer le polygone
            if (vertices.length > 0) vertices.push(vertices[0]);

            // Résultat final
            this.map.getSource('viewshed-result').setData({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [vertices]
                }
            });

            document.getElementById('los-result').innerText = `Terminé. Rayon: ${this.radius}m`;

        } catch (err) {
            console.log("Calcul interrompu:", err.message);
            document.getElementById('los-result').innerText = "Interrompu.";
        } finally {
            this.calculating = false;
            this.updateUIButton(); // Reset bouton
        }
    }

    /**
     * Générateur asynchrone qui traite les rayons par lots (Batch processing)
     */
    async *rayGenerator(startElev, metersPerDegLng, metersPerDegLat) {
        // Pré-calculer les layers de bâtiments actifs pour éviter de le faire dans la boucle
        const activeLayers = this.buildingLayers.filter(l => this.map.getLayer(l));

        for (let i = 0; i <= this.numRays; i++) {
            // Pause pour laisser le navigateur dessiner (tous les 5 rayons)
            // C'est ce qui empêche le freeze !
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));

            const angleDeg = (i / this.numRays) * 360;
            const angleRad = (angleDeg * Math.PI) / 180;
            
            const dirLng = Math.cos(angleRad) / metersPerDegLng;
            const dirLat = Math.sin(angleRad) / metersPerDegLat;

            // --- ALGORITHME DE PENTE MAX (HORIZON) ---
            let maxSlope = -Infinity;
            let currentDist = 0;
            let visibleDist = 0; // On initialise à 0, si on voit rien

            // Pas d'échantillonnage dynamique
            // On commence petit (près de l'observateur) et on augmente
            while (currentDist < this.radius) {
                const step = (currentDist < 50) ? 2 : (currentDist < 200 ? 5 : 10);
                currentDist += step;
                if (currentDist > this.radius) currentDist = this.radius;

                const lng = this.center.lng + (dirLng * currentDist);
                const lat = this.center.lat + (dirLat * currentDist);
                const pos = { lng, lat };

                // 1. Altitude du SOL
                const groundZ = this.map.queryTerrainElevation(pos) || 0;
                
                // Calcul de la pente vers ce point au sol
                // Pente = (Hauteur Cible - Hauteur Yeux) / Distance
                let slope = (groundZ - startElev) / currentDist;

                let isVisible = false;

                // Si la pente du sol est supérieure à tout ce qu'on a vu avant, on voit le sol !
                if (slope >= maxSlope) {
                    maxSlope = slope;
                    isVisible = true;
                    visibleDist = currentDist; // On voit au moins jusqu'ici
                }

                // 2. Vérification OBSTACLES (Bâtiments)
                // On ne vérifie que si le sol est visible (sinon on est déjà derrière une colline)
                // OU si on est très proche (car un mur peut être devant nous même en montée)
                if (isVisible || currentDist < 50) {
                    // Projection écran pour queryRenderedFeatures
                    // Attention: queryRenderedFeatures est lourd, on l'utilise avec parcimonie
                    const point = this.map.project(pos);
                    
                    // On vérifie s'il y a un bâtiment à ce pixel
                    const features = this.map.queryRenderedFeatures(point, { layers: activeLayers });
                    
                    if (features.length > 0) {
                        const f = features[0];
                        // Hauteur du bâtiment (fallback standard OSM)
                        const h = f.properties.height || f.properties.render_height || 10; 
                        const roofZ = groundZ + h;
                        
                        const roofSlope = (roofZ - startElev) / currentDist;

                        if (roofSlope > maxSlope) {
                            maxSlope = roofSlope;
                            // C'est un mur. On voit le mur, mais pas derrière.
                            visibleDist = currentDist;
                            // On arrête ce rayon ici, on a percuté un obstacle
                            break; 
                        }
                    }
                } else {
                    // Si on est bloqué par le terrain (la colline devant est plus haute)
                    // On continue quand même la boucle car une montagne plus loin peut dépasser (Peak)
                    // Sauf si la "contre-pente" est énorme, mais restons simples.
                }
            }

            // Calcul du point final visible pour ce rayon
            const endLng = this.center.lng + (dirLng * visibleDist);
            const endLat = this.center.lat + (dirLat * visibleDist);
            
            yield [endLng, endLat];
        }
    }

    createCircleGeoJSON(center, radiusInMeters) {
        const coords = [];
        const steps = 64;
        const km = radiusInMeters / 1000;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const lng = center.lng + (km / (111.32 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(angle);
            const lat = center.lat + (km / 111.32) * Math.sin(angle);
            coords.push([lng, lat]);
        }
        coords.push(coords[0]);
        return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
    }
}