// js/modules/intervisibilite.js

export class ViewshedTool {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.center = null;
        this.marker = null;
        this.radius = 500; 
        this.observerHeight = 2; // Hauteur de vue par défaut (2m)
        
        this.initLayers();
        
        // Liaison avec le slider HTML
        const slider = document.getElementById('range-radius');
        const radiusDisplay = document.getElementById('radius-val');
        if (slider) {
            slider.oninput = (e) => {
                this.radius = parseInt(e.target.value);
                if (radiusDisplay) radiusDisplay.innerText = this.radius;
                if (this.center) this.computeViewshed(); 
            };
        }
    }

    initLayers() {
        // Source pour le cercle de fond (Rouge)
        this.map.addSource('viewshed-base', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Source pour la zone visible (Vert)
        this.map.addSource('viewshed-visible', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        this.map.addLayer({
            id: 'layer-viewshed-red',
            type: 'fill',
            source: 'viewshed-base',
            paint: { 'fill-color': '#ff0000', 'fill-opacity': 0.3 }
        });

        this.map.addLayer({
            id: 'layer-viewshed-green',
            type: 'fill',
            source: 'viewshed-visible',
            paint: { 'fill-color': '#00ff00', 'fill-opacity': 0.5 }
        });
    }

    toggle() {
        this.active = !this.active;
        this.reset();
        const btn = document.getElementById('btn-viewshed');
        if (btn) {
            btn.classList.toggle('active-tool', this.active);
            btn.style.backgroundColor = this.active ? '#e74c3c' : '';
        }
        this.map.getCanvas().style.cursor = this.active ? 'crosshair' : '';
    }

    reset() {
        if (this.marker) this.marker.remove();
        this.center = null;
        this.map.getSource('viewshed-base').setData({ type: 'FeatureCollection', features: [] });
        this.map.getSource('viewshed-visible').setData({ type: 'FeatureCollection', features: [] });
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

    onClick(e) {
        if (!this.active) return;
        this.center = e.lngLat;
        
        if (this.marker) this.marker.remove();
        this.marker = new maplibregl.Marker({ color: "#3498db" })
            .setLngLat(this.center)
            .addTo(this.map);

        this.computeViewshed();
    }

    computeViewshed() {
        if (!this.center) return;

        const redCircle = this.createCircleGeoJSON(this.center, this.radius);
        this.map.getSource('viewshed-base').setData(redCircle);

        const angleStep = 4; 
        const samples = 30;  
        // queryTerrainElevation nécessite que le relief soit chargé (PMTiles mode)
        const centerElev = this.map.queryTerrainElevation(this.center) || 0;
        const startZ = centerElev + this.observerHeight;
        
        const vertices = [];
        const radiusInDeg = this.radius / 111320; 

        // Détection des calques de bâtiments selon le mode (config.js)
        const buildingLayers = ['building', 'buildings-3d'];

        for (let angle = 0; angle <= 360; angle += angleStep) {
            const rad = (angle * Math.PI) / 180;
            let lastX = this.center.lng;
            let lastY = this.center.lat;

            for (let s = 1; s <= samples; s++) {
                const distFrac = s / samples;
                const curLng = this.center.lng + Math.cos(rad) * radiusInDeg * distFrac;
                const curLat = this.center.lat + Math.sin(rad) * radiusInDeg * distFrac;
                const curPos = new maplibregl.LngLat(curLng, curLat);

                const groundZ = this.map.queryTerrainElevation(curPos) || 0;
                const pointOnScreen = this.map.project(curPos);
                
                // On vérifie si un bâtiment intersecte ce point
                const features = this.map.queryRenderedFeatures(pointOnScreen, { layers: buildingLayers.filter(id => this.map.getLayer(id)) });
                
                let bHeight = 0;
                if (features.length > 0) {
                    // hField est 'render_height' pour MBTiles et 'height' pour PMTiles dans votre config
                    bHeight = features[0].properties.height || features[0].properties.render_height || 0;
                }

                // Obstacle si le sol ou le bâtiment dépasse la ligne de vue
                if (groundZ > startZ || (groundZ + bHeight) > startZ) {
                    break; 
                }
                lastX = curLng;
                lastY = curLat;
            }
            vertices.push([lastX, lastY]);
        }

        const greenCoords = [ [this.center.lng, this.center.lat], ...vertices, [this.center.lng, this.center.lat] ];

        this.map.getSource('viewshed-visible').setData({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [greenCoords] }
        });
    }
}