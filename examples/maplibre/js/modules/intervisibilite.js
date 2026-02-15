// js/modules/intervisibilite.js

export class ViewshedTool {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.calculating = false;
        this.abortController = null;
        this.center = null;
        this.marker = null;
        
        // --- CONFIGURATION ---
        this.radius = 500; 
        this.observerHeight = 2.0; 
        this.numRays = 360; // On augmente à 360 pour un beau cercle final, grâce à l'opti progressive
        
        // Calques Bâtiments
        this.buildingLayers = ['building', 'buildings-3d', 'building-extrusion', 'buildings'];

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
            };
            // On recalcule au relâchement pour éviter de spammer pendant le drag
            slider.onchange = () => {
                if (this.center) this.startAsyncCalculation();
            };
        }
    }

    initLayers() {
        if(!this.map.getSource('viewshed-base')) {
            this.map.addSource('viewshed-base', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if(!this.map.getSource('viewshed-result')) {
            this.map.addSource('viewshed-result', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }

        // ROUGE (Théorique)
        if(!this.map.getLayer('layer-viewshed-red')) {
            this.map.addLayer({
                id: 'layer-viewshed-red', type: 'fill', source: 'viewshed-base',
                paint: { 'fill-color': '#e74c3c', 'fill-opacity': 0.15, 'fill-outline-color': '#c0392b' }
            });
        }

        // VERT (Visible)
        if(!this.map.getLayer('layer-viewshed-green')) {
            this.map.addLayer({
                id: 'layer-viewshed-green', type: 'fill', source: 'viewshed-result',
                paint: { 'fill-color': '#00ff00', 'fill-opacity': 0.5, 'fill-outline-color': '#27ae60' }
            });
        }
    }

    toggle() {
        this.active = !this.active;
        if (!this.active) {
            this.reset();
            if (this.calculating && this.abortController) {
                this.abortController.abort();
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
                btn.style.backgroundColor = '#f39c12';
                btn.innerHTML = progress ? `⏳ ${progress}%` : '⏳ Calcul...';
            } else {
                btn.style.backgroundColor = '#e74c3c';
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
        if (!this.active) return;
        // Si déjà en calcul, on annule le précédent et on relance
        if (this.calculating && this.abortController) {
            this.abortController.abort();
        }

        this.center = e.lngLat;
        
        if (this.marker) this.marker.remove();
        this.marker = new maplibregl.Marker({ color: "#2980b9" }).setLngLat(this.center).addTo(this.map);

        this.startAsyncCalculation();
    }

    // --- GÉNÉRATION D'INDICES POUR LE RENDU PROGRESSIF ---
    // Retourne une liste d'indices [0, 180, 90, 270, 45, 135...] pour scanner le cercle
    // d'abord grossièrement, puis finement.
    getInterlacedIndices(total) {
        const indices = [];
        const taken = new Uint8Array(total);
        
        // Pas successifs : 1/8eme, 1/16eme, 1/32eme...
        // On commence par un pas grossier pour avoir une forme rapide
        const steps = [32, 8, 4, 2, 1]; 

        for (let step of steps) {
            for (let i = 0; i < total; i += step) {
                if (!taken[i]) {
                    indices.push(i);
                    taken[i] = 1;
                }
            }
        }
        return indices;
    }

    async startAsyncCalculation() {
        this.calculating = true;
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        
        this.updateUIButton(0);
        document.getElementById('los-result').innerText = "Initialisation...";

        // 1. Cercle Rouge (Base)
        const redCircle = this.createCircleGeoJSON(this.center, this.radius);
        this.map.getSource('viewshed-base').setData(redCircle);

        // 2. Préparation des données
        // Tableau fixe pour stocker les résultats dans l'ordre angulaire correct
        // index 0 = 0°, index 90 = 90°, etc.
        this.rayResults = new Array(this.numRays).fill(null);

        const startElev = (this.map.queryTerrainElevation(this.center) || 0) + this.observerHeight;
        
        // --- OPTIMISATION ZOOM ---
        // Si zoom < 13, on ignore les bâtiments car ils ne sont pas affichés
        const currentZoom = this.map.getZoom();
        const ignoreBuildings = currentZoom < 13;

        // --- OPTIMISATION RENDU PROGRESSIF ---
        const processingOrder = this.getInterlacedIndices(this.numRays);

        const latRad = this.center.lat * Math.PI / 180;
        const metersPerDegLng = 111320 * Math.cos(latRad);
        const metersPerDegLat = 110574;

        try {
            let processedCount = 0;
            
            // Générateur
            const generator = this.rayGenerator(processingOrder, startElev, metersPerDegLng, metersPerDegLat, ignoreBuildings);

            for await (const result of generator) {
                if (signal.aborted) throw new Error("Annulé");
                
                // result = { index: 45, coords: [lng, lat] }
                // On insère le résultat à sa place FIXE dans le tableau (trié par angle)
                this.rayResults[result.index] = result.coords;
                
                processedCount++;

                // Mise à jour visuelle PROGRESSIVE
                // On rafraichit la carte tous les X rayons ou selon le "Pas" en cours
                // Au début (gros pas), on rafraichit souvent pour l'effet "Waouh"
                const shouldRefresh = (processedCount < 60 && processedCount % 5 === 0) || (processedCount % 30 === 0);

                if (shouldRefresh) {
                    this.updatePolygon();
                    const pct = Math.round((processedCount / this.numRays) * 100);
                    this.updateUIButton(pct);
                }
            }

            // Rafraichissement final
            this.updatePolygon();
            document.getElementById('los-result').innerText = `Terminé. Rayon: ${this.radius}m ${ignoreBuildings ? '(Bâtiments ignorés)' : ''}`;

        } catch (err) {
            if (err.message !== "Annulé") console.error(err);
            document.getElementById('los-result').innerText = "Arrêté.";
        } finally {
            this.calculating = false;
            this.updateUIButton();
        }
    }

    updatePolygon() {
        // On prend le tableau complet et on enlève les trous (null)
        // Comme c'est un Array pré-alloué indexé par l'angle, l'ordre est garanti !
        const validCoords = this.rayResults.filter(c => c !== null);
        
        if (validCoords.length < 3) return;

        // Fermeture du polygone
        const finalCoords = [...validCoords, validCoords[0]];

        this.map.getSource('viewshed-result').setData({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [finalCoords] }
        });
    }

    async *rayGenerator(indicesOrder, startElev, metersPerDegLng, metersPerDegLat, ignoreBuildings) {
        const activeLayers = this.buildingLayers.filter(l => this.map.getLayer(l));

        for (let k = 0; k < indicesOrder.length; k++) {
            // Pause pour l'UI
            if (k % 5 === 0) await new Promise(r => setTimeout(r, 0));

            const i = indicesOrder[k]; // L'index réel (l'angle)
            
            const angleDeg = (i / this.numRays) * 360;
            const angleRad = (angleDeg * Math.PI) / 180;
            
            const dirLng = Math.cos(angleRad) / metersPerDegLng;
            const dirLat = Math.sin(angleRad) / metersPerDegLat;

            let maxSlope = -Infinity;
            let currentDist = 0;
            let visibleDist = 0; 
            
            // Pas variable selon la distance
            while (currentDist < this.radius) {
                const step = (currentDist < 50) ? 2 : (currentDist < 200 ? 5 : 15);
                currentDist += step;
                if (currentDist > this.radius) currentDist = this.radius;

                const lng = this.center.lng + (dirLng * currentDist);
                const lat = this.center.lat + (dirLat * currentDist);
                const pos = { lng, lat };

                const groundZ = this.map.queryTerrainElevation(pos) || 0;
                let slope = (groundZ - startElev) / currentDist;

                let isVisible = false;

                if (slope >= maxSlope) {
                    maxSlope = slope;
                    isVisible = true;
                    visibleDist = currentDist;
                }

                // --- VÉRIFICATION BÂTIMENTS (Seulement si affichés) ---
                if (!ignoreBuildings && (isVisible || currentDist < 50)) {
                    // On ne check que si le sol est visible OU très proche
                    const point = this.map.project(pos);
                    const features = this.map.queryRenderedFeatures(point, { layers: activeLayers });
                    
                    if (features.length > 0) {
                        const f = features[0];
                        const h = f.properties.height || f.properties.render_height || 10; 
                        const roofZ = groundZ + h;
                        const roofSlope = (roofZ - startElev) / currentDist;

                        if (roofSlope > maxSlope) {
                            maxSlope = roofSlope;
                            visibleDist = currentDist;
                            break; // MUR
                        }
                    }
                }
            }

            const endLng = this.center.lng + (dirLng * visibleDist);
            const endLat = this.center.lat + (dirLat * visibleDist);
            
            // On renvoie l'index d'origine pour savoir où le placer dans le tableau
            yield { index: i, coords: [endLng, endLat] };
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