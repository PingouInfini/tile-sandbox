import { initMap } from './modules/map.js';
import { initLayers } from './modules/layers.js';
import { initSearch } from './modules/search.js';
import { initRoute } from './modules/route.js';
import { initUI } from './modules/ui.js';

// 1. Initialisation de la carte
const map = initMap();

// 2. Initialisation des modules dépendants de la carte
initLayers(map);
initSearch(map);
initRoute(map);

// 3. Initialisation de l'interface générale
initUI();

// Export pour debug console
window.map = map;