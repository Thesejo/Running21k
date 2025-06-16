// Configuración del mapa
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [-99.1332, 19.4326], // CDMX [lng, lat]
    zoom: 14
});

// Variables de estado
let currentPosition = null;
let pathCoordinates = [];
let startTime = null;
let timerInterval = null;
let totalDistance = 0;
let raceId = null;

// Elementos UI
const speedElement = document.getElementById('speed');
const distanceElement = document.getElementById('distance');
const timeElement = document.getElementById('time');

// Fuente y capa para la ruta
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
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#4264fb',
            'line-width': 4
        }
    });
});

// Marcador de posición
const marker = new maplibregl.Marker({
    color: "#4264fb",
    scale: 1.2
}).setLngLat([0, 0]).addTo(map);

// Iniciar seguimiento GPS
function startTracking() {
    if (navigator.geolocation) {
        startTime = new Date();
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        
        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        };
        
        watchId = navigator.geolocation.watchPosition(
            updatePosition,
            handleError,
            options
        );
    } else {
        alert("Tu navegador no soporta geolocalización");
    }
}

// Actualizar posición
function updatePosition(position) {
    const coords = [position.coords.longitude, position.coords.latitude];
    currentPosition = coords;
    
    // Actualizar marcador
    marker.setLngLat(coords);
    map.flyTo({ center: coords });
    
    // Calcular distancia si hay posición previa
    if (pathCoordinates.length > 0) {
        const lastPos = pathCoordinates[pathCoordinates.length - 1];
        const distance = calculateDistance(
            lastPos[1], lastPos[0], 
            coords[1], coords[0]
        );
        totalDistance += distance;
        distanceElement.textContent = totalDistance.toFixed(2);
    }
    
    // Actualizar velocidad (convertir m/s a km/h)
    const speed = position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : "0.0";
    speedElement.textContent = speed;
    
    // Añadir a la ruta
    pathCoordinates.push(coords);
    updateRoute();
}

// Actualizar la línea de ruta
function updateRoute() {
    const source = map.getSource('route');
    source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: pathCoordinates
        }
    });
}

// Calcular distancia entre coordenadas (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Actualizar temporizador
function updateTimer() {
    const now = new Date();
    const elapsed = new Date(now - startTime);
    const hours = elapsed.getUTCHours().toString().padStart(2, '0');
    const minutes = elapsed.getUTCMinutes().toString().padStart(2, '0');
    const seconds = elapsed.getUTCSeconds().toString().padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

// Manejo de errores
function handleError(error) {
    console.error("Error de geolocalización:", error);
    alert(`Error: ${error.message}`);
}

// Iniciar automáticamente al cargar
window.addEventListener('load', () => {
    startTracking();
});
