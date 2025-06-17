// Configuración del mapa (usa tu API key de MapTiler)
const MAPTILER_KEY = 'TU_API_KEY'; // Regístrate en https://www.maptiler.com/
const map = new maplibregl.Map({
    container: 'map',
    style: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
    center: [-99.1332, 19.4326], // [longitud, latitud]
    zoom: 15
});

// Variables de estado
let currentPosition = null;
let pathCoordinates = [];
let startTime = null;
let timerInterval = null;
let totalDistance = 0;

// Elementos UI
const speedElement = document.getElementById('speed');
const distanceElement = document.getElementById('distance');
const timeElement = document.getElementById('time');

// Marcador de posición
const marker = new maplibregl.Marker({
    color: "#FF0000",
    scale: 1.2
}).setLngLat([0, 0]).addTo(map);

// Capa de ruta
map.on('load', () => {
    map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: []
            }
        }
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        paint: {
            'line-color': '#FF5722',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    // Añadir etiquetas de calles (solo en modo satélite/híbrido)
    map.addLayer({
        id: 'road-labels',
        type: 'symbol',
        source: {
            type: 'vector',
            url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`
        },
        'source-layer': 'transportation',
        layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-allow-overlap': true
        },
        paint: {
            'text-color': '#FFFFFF',
            'text-halo-color': '#000000',
            'text-halo-width': 1
        }
    });
});

// Cambiar estilo del mapa
function changeMapStyle(style) {
    const styles = {
        hybrid: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
        satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
        streets: `https://api.maptiler.com/maps/streets/style.json?key=${MAPTILER_KEY}`
    };
    map.setStyle(styles[style]);
}

// Iniciar seguimiento GPS
function startTracking() {
    if (navigator.geolocation) {
        startTime = new Date();
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        
        navigator.geolocation.watchPosition(
            updatePosition,
            handleError,
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    } else {
        alert("Geolocalización no soportada");
    }
}

// Actualizar posición
function updatePosition(position) {
    const coords = [position.coords.longitude, position.coords.latitude];
    
    // Actualizar marcador
    marker.setLngLat(coords);
    map.flyTo({ center: coords, zoom: 17 }); // Zoom más cercano

    // Calcular distancia
    if (pathCoordinates.length > 0) {
        const lastPos = pathCoordinates[pathCoordinates.length - 1];
        totalDistance += calculateDistance(lastPos[1], lastPos[0], coords[1], coords[0]);
        distanceElement.textContent = totalDistance.toFixed(2);
    }

    // Actualizar velocidad (m/s → km/h)
    speedElement.textContent = (position.coords.speed * 3.6 || 0).toFixed(1);

    // Guardar ruta
    pathCoordinates.push(coords);
    updateRoute();
}

// Resto del código (calculateDistance, updateRoute, updateTimer, handleError) se mantiene igual que en la versión anterior

// Iniciar automáticamente
startTracking();
