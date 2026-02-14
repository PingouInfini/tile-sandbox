// js/modules/intervisibilite.js

export class ViewshedTool {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.center = null;
        this.marker = null;
        
        // --- CONFIGURATION ---
        this.radius = 500; 
        this.observerHeight = 1.7; // Hauteur des yeux (homme moyen)
        this.targetHeight = 1;     // On regarde le sol (0m). Mettre 1m pour voir des objets.
        this.numRays = 240;        // nb rayons => précision de 360°/numRays (en degré)
        
        // Calques à considérer comme obstacles (Bâtiments)
        this.buildingLayers = ['building', 'buildings-3d'];

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
                
                // Debounce pour ne pas figer le navigateur pendant le glissement
                if (this.timer) clearTimeout(this.timer);
                this.timer = setTimeout(() => {
                    if (this.center) this.computeViewshed();
                }, 50);
            };
        }
    }

    initLayers() {
        // 1. Source Base (Le disque rouge complet)
        this.map.addSource('viewshed-base', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        
        // 2. Source Result (Le polygone vert de ce qui est visible)
        this.map.addSource('viewshed-result', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // CALQUE ROUGE (Tout ce qui est dans le rayon, supposé caché par défaut)
        this.map.addLayer({
            id: 'layer-viewshed-red',
            type: 'fill',
            source: 'viewshed-base',
            paint: { 
                'fill-color': '#e74c3c', 
                'fill-opacity': 0.2,
                'fill-outline-color': '#c0392b'
            }
        });

        // CALQUE VERT (Ce qui est réellement visible, par-dessus le rouge)
        this.map.addLayer({
            id: 'layer-viewshed-green',
            type: 'fill',
            source: 'viewshed-result',
            paint: { 
                'fill-color': '#2ecc71', 
                'fill-opacity': 0.6, // Plus opaque pour bien couvrir le rouge
                'fill-outline-color': '#27ae60' 
            }
        });
    }

    toggle() {
        this.active = !this.active;
        this.reset();
        
        const btn = document.getElementById('btn-viewshed');
        if (btn) {
            if (this.active) {
                btn.classList.add('active-tool');
                btn.style.backgroundColor = '#e74c3c';
                btn.innerHTML = '❌ Arrêter';
                this.map.getCanvas().style.cursor = 'crosshair';
            } else {
                btn.classList.remove('active-tool');
                btn.style.backgroundColor = '';
                btn.innerHTML = '🔭 Calculer Viewshed';
                this.map.getCanvas().style.cursor = '';
            }
        }
    }

    reset() {
        if (this.marker) this.marker.remove();
        this.center = null;
        this.map.getSource('viewshed-base').setData({ type: 'FeatureCollection', features: [] });
        this.map.getSource('viewshed-result').setData({ type: 'FeatureCollection', features: [] });
    }

    onClick(e) {
        if (!this.active) return;
        this.center = e.lngLat;
        
        if (this.marker) this.marker.remove();
        this.marker = new maplibregl.Marker({ color: "#2c3e50" })
            .setLngLat(this.center)
            .addTo(this.map);

        this.computeViewshed();
    }

    computeViewshed() {
        if (!this.center) return;

        // 1. Dessiner le cercle ROUGE complet (Base)
        const redCircle = this.createCircleGeoJSON(this.center, this.radius);
        this.map.getSource('viewshed-base').setData(redCircle);

        // --- PRÉ-CALCULS ---
        const startElev = (this.map.queryTerrainElevation(this.center) || 0) + this.observerHeight;
        const activeBuildingLayers = this.buildingLayers.filter(l => this.map.getLayer(l));
        
        // Facteurs de conversion Lat/Lng -> Mètres
        const latRad = this.center.lat * Math.PI / 180;
        const metersPerDegLng = 111320 * Math.cos(latRad);
        const metersPerDegLat = 110574;

        const vertices = [];
        
        // --- LANCER DE RAYONS ---
        for (let i = 0; i <= this.numRays; i++) {
            // Boucler le cercle
            const angleDeg = (i / this.numRays) * 360;
            const angleRad = (angleDeg * Math.PI) / 180;
            
            // Vecteur unitaire (direction)
            const dirLng = Math.cos(angleRad) / metersPerDegLng;
            const dirLat = Math.sin(angleRad) / metersPerDegLat;

            // Variables d'état du rayon
            let dist = 0;
            let maxSlope = -Infinity; // Pente maximale rencontrée
            let visibleDist = 0;      // Jusqu'où on voit actuellement
            
            // Optimisation : On ne vérifie pas les bâtiments si le terrain bloque déjà
            let terrainBlocked = false; 

            // BOUCLE DE DISTANCE (STEP)
            while (dist < this.radius) {
                // --- PAS DYNAMIQUE (Crucial pour les murs) ---
                // Près : 1m (précision max), Loin : 15m (performance)
                let step = (dist < 50) ? 1.5 : (dist < 200 ? 5 : 15);
                
                dist += step;
                if (dist > this.radius) dist = this.radius;

                const curLng = this.center.lng + (dirLng * dist);
                const curLat = this.center.lat + (dirLat * dist);
                const pos = new maplibregl.LngLat(curLng, curLat);

                // 1. Altitude du SOL
                const groundZ = this.map.queryTerrainElevation(pos) || 0;
                let obstacleZ = groundZ;

                // 2. Calcul de la Pente vers le sol
                const slopeToGround = (groundZ - startElev) / dist;

                // Si le sol lui-même est caché par une colline précédente
                if (slopeToGround < maxSlope) {
                    terrainBlocked = true;
                } else {
                    // Le sol est visible, on met à jour la pente max vue
                    maxSlope = slopeToGround;
                    visibleDist = dist;
                    terrainBlocked = false;
                }

                // 3. Vérification des BÂTIMENTS (seulement si le sol est visible)
                // Cela évite des appels coûteux si on est déjà derrière une colline
                if (!terrainBlocked) {
                    const screenPoint = this.map.project(pos);
                    const features = this.map.queryRenderedFeatures(screenPoint, { 
                        layers: activeBuildingLayers 
                    });

                    if (features.length > 0) {
                        const f = features[0];
                        const h = f.properties.height || f.properties.render_height || 0;
                        
                        // Le toit du bâtiment
                        const roofZ = groundZ + h;
                        const slopeToRoof = (roofZ - startElev) / dist;

                        // Si le toit bloque la vue (sa pente est supérieure à la pente actuelle)
                        if (slopeToRoof > maxSlope) {
                            maxSlope = slopeToRoof;
                            // On voit le mur du bâtiment, mais on ne voit rien derrière
                            // Donc on arrête le rayon ICI.
                            visibleDist = dist; 
                            break; // STOP : On a tapé un mur
                        }
                    }
                } else {
                    // Si le sol est bloqué par le relief, on arrête tout de suite ? 
                    // Non, car un bâtiment haut pourrait dépasser de la colline.
                    // Mais dans un algo simple, on considère souvent que si le sol est caché, c'est fini.
                    // Pour plus de précision relief : on continue.
                    // Pour perf : on peut break ici.
                    
                    // Choix Précision : On break si on est "vraiment" enterré
                    if (maxSlope - slopeToGround > 0.1) break; 
                }

                if (dist >= this.radius) visibleDist = dist;
            }

            // Fin du rayon
            const endLng = this.center.lng + (dirLng * visibleDist);
            const endLat = this.center.lat + (dirLat * visibleDist);
            vertices.push([endLng, endLat]);
        }

        // Fermeture du polygone
        vertices.push(vertices[0]);

        // Mise à jour de la source VERTE
        this.map.getSource('viewshed-result').setData({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [vertices]
            }
        });
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