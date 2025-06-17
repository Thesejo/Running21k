// Configuración inicial del mapa con OpenStreetMap
const map = L.map('map').setView([19.4326, -99.1332], 15);

// Capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Variables del corredor
let path = [];
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isTracking = false;
let multiplayerMode = false;

// Marcador del jugador local
const playerIcon = L.divIcon({
    className: 'player-icon',
    html: '<div style="background:#e74c3c;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [26, 26]
});

const playerMarker = L.marker([0, 0], { icon: playerIcon }).addTo(map);
const playerRoute = L.polyline([], { color: '#e74c3c', weight: 5 }).addTo(map);

// Marcadores de otros jugadores
const otherPlayers = {};
const otherPlayerIcon = L.divIcon({
    className: 'other-player-icon',
    html: '<div style="background:#3498db;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [22, 22]
});

// Elementos UI
const multiplayerBtn = document.getElementById('multiplayer-btn');
const multiplayerControls = document.getElementById('multiplayer-controls');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id');
const playersList = document.getElementById('players-list');

// Eventos
multiplayerBtn.addEventListener('click', toggleMultiplayerMode);
joinRoomBtn.addEventListener('click', joinRoom);

// Iniciar seguimiento GPS
function startTracking() {
    if (navigator.geolocation) {
        isTracking = true;
        startTime = new Date();
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        
        navigator.geolocation.watchPosition(
            updatePosition,
            handleGeolocationError,
            { 
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000 
            }
        );
    } else {
        alert("Tu navegador no soporta geolocalización. Usa Chrome o Firefox en móvil.");
    }
}

function updatePosition(position) {
    const coords = [position.coords.latitude, position.coords.longitude];
    
    // Actualizar marcador y vista del mapa
    playerMarker.setLatLng(coords);
    map.setView(coords, 17);
    
    // Calcular distancia
    if (path.length > 0) {
        const lastPos = path[path.length - 1];
        const distance = calculateDistance(...lastPos, ...coords);
        totalDistance += distance;
        document.getElementById('distance').textContent = (totalDistance / 1000).toFixed(2) + ' km';
    }
    
    // Actualizar velocidad
    document.getElementById('speed').textContent = (position.coords.speed * 3.6 || 0).toFixed(1) + ' km/h';
    
    // Guardar ruta
    path.push(coords);
    playerRoute.setLatLngs(path);
    
    // Enviar posición al servidor si está en modo multijugador
    if (multiplayerMode && socket) {
        socket.emit('playerUpdate', {
            position: coords,
            distance: totalDistance,
            speed: (position.coords.speed * 3.6 || 0).toFixed(1)
        });
    }
}

// Función para calcular distancia entre coordenadas (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function updateTimer() {
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('time').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function handleGeolocationError(error) {
    console.error("Error GPS:", error);
    let message;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "Debes permitir acceso a tu ubicación para usar esta app";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Tu ubicación no está disponible";
            break;
        case error.TIMEOUT:
            message = "Tiempo de espera agotado";
            break;
        default:
            message = "Error desconocido";
    }
    alert("Running Tracker: " + message);
}

function toggleMultiplayerMode() {
    multiplayerMode = !multiplayerMode;
    
    if (multiplayerMode) {
        multiplayerBtn.textContent = "Multijugador: ON";
        multiplayerBtn.style.background = "#2ecc71";
        multiplayerControls.classList.remove('hidden');
        
        if (!isTracking) {
            startTracking();
        }
    } else {
        multiplayerBtn.textContent = "Multijugador: OFF";
        multiplayerBtn.style.background = "#e74c3c";
        multiplayerControls.classList.add('hidden');
        
        // Limpiar otros jugadores
        Object.values(otherPlayers).forEach(player => {
            if (player.marker) map.removeLayer(player.marker);
            if (player.route) map.removeLayer(player.route);
        });
    }
}

function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socket.emit('joinRoom', roomId);
    } else {
        alert("Por favor ingresa un ID de sala");
    }
}

// Iniciar seguimiento al cargar la página
startTracking();
