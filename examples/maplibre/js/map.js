const map = new maplibregl.Map({
  container: 'map',
  center: [2.0885, 48.7892], // centre approximatif Paris Sud-Ouest
  zoom: 8,
  style: {
    "version": 8,
    "glyphs": "http://192.168.10.3:8898/fonts/{fontstack}/{range}.pbf",
    "sources": {
      "osm": {
        "type": "vector",
        "tiles": [
          "http://192.168.10.3:8899/services/maptiler-osm-2020-02-10-v3.11-planet/tiles/{z}/{x}/{y}.pbf"
        ],
        "minzoom": 0,
        "maxzoom": 14
      },
      "paris_sudouest": {
        "type": "raster",
        "tiles": [
          "http://192.168.10.3:8899/services/paris_sudouest/tiles/{z}/{x}/{y}.png"
        ],
        "tileSize": 256,
        "minzoom": 12,
        "maxzoom": 22,
        "bounds": [
          1.9027024815136719,
          48.734721129364807,
          2.2742903540188601,
          48.8437560209994
        ]
      }
    },
    "layers": [
      {
        "id": "background",
        "type": "background",
        "paint": {
          "background-color": "#ddeeff"
        }
      },
      {
        "id": "land",
        "type": "fill",
        "source": "osm",
        "source-layer": "land",
        "paint": {
          "fill-color": "#f2efe9"
        }
      },
      {
        "id": "water",
        "type": "fill",
        "source": "osm",
        "source-layer": "water",
        "paint": {
          "fill-color": "#a0c8f0"
        }
      },
      {
        "id": "waterway",
        "type": "line",
        "source": "osm",
        "source-layer": "waterway",
        "paint": {
          "line-color": "#a0c8f0",
          "line-width": 1
        }
      },
      {
        "id": "roads",
        "type": "line",
        "source": "osm",
        "source-layer": "transportation",
        "paint": {
          "line-color": "#ffffff",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5, 0.2,
            12, 2
          ]
        }
      },

      /*
      {
        "id": "buildings",
        "type": "fill",
        "source": "osm",
        "source-layer": "building",
        "minzoom": 12,
        "paint": {
          "fill-color": "#d1cfc9",
          "fill-outline-color": "#b0aea8"
        }
      },
      */

      {
        "id": "buildings-3d",
        "type": "fill-extrusion",
        "source": "osm",
        "source-layer": "building",
        "minzoom": 13,
        "filter": [
          "all",
          ["!=", ["get", "hide_3d"], true]
        ],
        "paint": {
          "fill-extrusion-color": [
            "coalesce",
            ["get", "colour"],
            "#d1cfc9"
          ],
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            10
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            0
          ],
          "fill-extrusion-opacity": 0.9
        }
      },
      {
        "id": "place-labels",
        "type": "symbol",
        "source": "osm",
        "source-layer": "place",
        "layout": {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4, 10,
            10, 16
          ]
        },
        "paint": {
          "text-color": "#333333",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1
        }
      },
      {
        "id": "road-labels",
        "type": "symbol",
        "source": "osm",
        "source-layer": "transportation_name",
        "minzoom": 13,
        "layout": {
          "text-field": [
            "coalesce",
            ["get", "name"],
            ["get", "ref"]
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13, 8,
            16, 10
          ],
          "symbol-placement": "line",
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "map",
          "text-letter-spacing": 0.05
        },
        "paint": {
          "text-color": "#333333",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1
        }
      },
      {
        "id": "paris-sudouest-overlay",
        "type": "raster",
        "source": "paris_sudouest",
        "paint": {
          "raster-opacity": 0.85,
          "raster-fade-duration": 0
        }
      }
    ]
  }
});

map.on("load", () => {

  // ON/OFF des layers
  document.querySelectorAll('[data-layer]').forEach(input => {
    input.addEventListener('change', (e) => {
      const layerId = e.target.dataset.layer;
      const visible = e.target.checked ? 'visible' : 'none';

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible);
      }
    });
  });

  // Couleurs dynamiques
  document.querySelectorAll('[data-layer-color]').forEach(input => {
    input.addEventListener('input', (e) => {
      const layerId = e.target.dataset.layerColor;
      const color = e.target.value;

      if (!map.getLayer(layerId)) return;

      const layer = map.getLayer(layerId);

      switch (layer.type) {
        case 'fill':
          map.setPaintProperty(layerId, 'fill-color', color);
          break;

        case 'line':
          map.setPaintProperty(layerId, 'line-color', color);
          break;

        case 'fill-extrusion':
          map.setPaintProperty(layerId, 'fill-extrusion-color', color);
          break;

        default:
          console.warn(`Couleur non supportée pour le layer ${layerId}`);
      }
    });
  });

});
