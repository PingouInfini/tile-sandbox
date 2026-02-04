const MAP_CONFIG = {
    // --- GESTION DES URLS ---
    urls: {
        fonts: "http://192.168.10.3:8898/fonts/{fontstack}/{range}.pbf",
        mbtiles_osm: ["http://192.168.10.3:8899/services/maptiler-osm-2020-02-10-v3.11-planet/tiles/{z}/{x}/{y}.pbf"],
        pmtiles_osm: "pmtiles://http://192.168.10.3:8898/pmtiles/world.pmtiles",
        pmtiles_elevation_corse: "pmtiles://http://192.168.10.3:8898/pmtiles/corse_elevation.pmtiles",
        pmtiles_elevation_alpes: "pmtiles://http://192.168.10.3:8898/pmtiles/alpes_elevation.pmtiles",
        raster_paris: ["http://192.168.10.3:8899/services/paris_sudouest/tiles/{z}/{x}/{y}.png"],

        // Autres services
        photon_api: "http://192.168.10.3:8898/photon/api",
        graphhopper_api: "http://192.168.10.3:8898/gh/route",
    },

    // --- SCHÉMAS DE COUCHES ---
    schemas: {
        // Configuration pour MBTiles (OpenMapTiles)
        openmaptiles: {
            storageKey: 'mbtiles_config_v1',
            extraLayers: [
                { 
                    id: "paris-layer", 
                    type: "raster", 
                    source: "paris_raster", 
                    minzoom: 0, 
                    order: 1.5 // Entre fill (1) et line (2) [fill-extrusion (3), symbol (4)];
                }
            ],
            layers: [
                { id: 'landcover', source: 'landcover', type: 'fill', color: '#add19e', desc: 'Végétation', minzoom: 10 },
                { id: 'landuse', source: 'landuse', type: 'fill', color: '#e0dfdf', desc: 'Usage du sol', minzoom: 5 },
                { id: 'park', source: 'park', type: 'fill', color: '#c8facc', desc: 'Parcs', minzoom: 5 },
                { id: 'water', source: 'water', type: 'fill', color: '#a0c8f0', desc: 'Eau (Surfaces)', minzoom: 0 },
                { id: 'waterway', source: 'waterway', type: 'line', color: '#a0c8f0', desc: 'Cours d\'eau', minzoom: 8 },
                { id: 'boundary', source: 'boundary', type: 'line', color: '#7c71c1', desc: 'Frontières', minzoom: 0 },
                { id: 'aeroway', source: 'aeroway', type: 'line', color: '#bbbbcc', desc: 'Aéroports', minzoom: 8 },
                { id: 'transportation', source: 'transportation', type: 'line', color: '#ffffff', desc: 'Routes', minzoom: 4 },
                { id: 'transportation-labels', source: 'transportation_name', type: 'symbol', color: '#444444', desc: 'Routes (Noms)', minzoom: 12, isRoadLabel: true },
                { id: 'building', source: 'building', type: 'fill-extrusion', color: '#d1cfc9', desc: 'Bâtiments 3D', minzoom: 13, hField: 'render_height', bField: 'render_min_height' },
                { id: 'place-labels', source: 'place', type: 'symbol', color: '#333333', desc: 'Villes & Lieux', minzoom: 3 },
                { id: 'poi-labels', source: 'poi', type: 'symbol', color: '#666666', desc: 'Points d\'intérêt', minzoom: 4 }
            ]
        },
        // Configuration pour PMTiles (Protomaps)
        protomaps: {
            storageKey: 'pmtiles_config_v1',
            extraLayers: [
                { 
                    id: "hillshade-corse", 
                    type: "hillshade", 
                    source: "hill_corse", 
                    order: 0.5, // Sous les polygones
                    paint: { "hillshade-shadow-color": "#473b31", "hillshade-exaggeration": 0.5 } 
                },
                { 
                    id: "hillshade-alpes", 
                    type: "hillshade", 
                    source: "hill_alpes", 
                    order: 0.5,
                    paint: { "hillshade-shadow-color": "#473b31", "hillshade-exaggeration": 0.5 } 
                }
            ],
            layers: [
                { id: 'earth', source: 'earth', type: 'fill', color: '#f2efe9', desc: 'Terre (Base)', minzoom: 0 },
                { id: 'landuse', source: 'landuse', type: 'fill', color: '#e8e6df', desc: 'Usage du sol', minzoom: 4 },
                { id: 'landcover', source: 'landcover', type: 'fill', color: '#add19e', desc: 'Végétation', minzoom: 10 },
                // Correction EAU PMTiles (Séparation via filtres)
                { id: 'water-fill', source: 'water', type: 'fill', color: '#a0c8f0', desc: 'Eau (Surfaces)', filter: ["==", ["geometry-type"], "Polygon"] },
                { id: 'water-line', source: 'water', type: 'line', color: '#a0c8f0', desc: 'Eau (Lignes)', filter: ["==", ["geometry-type"], "LineString"] },
                { id: 'roads', source: 'roads', type: 'line', color: '#ffffff', desc: 'Routes', minzoom: 4 },
                { id: 'roads-labels', source: 'roads', type: 'symbol', color: '#444444', desc: 'Routes (Noms)', minzoom: 13, isRoadLabel: true },
                { id: 'boundaries', source: 'boundaries', type: 'line', color: '#7c71c1', desc: 'Frontières', minzoom: 0 },
                { id: 'buildings-3d', source: 'buildings', type: 'fill-extrusion', color: '#d1cfc9', desc: 'Bâtiments 3D', minzoom: 13, hField: 'height', bField: 'min_height' },
                { id: 'places-labels', source: 'places', type: 'symbol', color: '#333333', desc: 'Villes', minzoom: 2 },
                { id: 'pois-labels', source: 'pois', type: 'symbol', color: '#666666', desc: 'Points d\'intérêt', minzoom: 10 }
            ]
        }
    }
};