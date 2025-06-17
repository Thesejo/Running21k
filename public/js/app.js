// Configuración inicial del mapa
const map = L.map('map').setView([19.4326, -99.1332], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Variables globales
let path = [];
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isTracking = false;
let isPaused = false;
let trackingWatchId = null;
let multiplayerMode = false;
let otherPlayers = {};
const playerIcon = L.divIcon({
    className: 'player-icon',
    html: '<div class="player-marker"></div>',
    iconSize: [24, 24]
});

// Elementos del jugador
const playerMarker = L.marker([0, 0], { 
    icon: playerIcon,
    zIndexOffset: 1000
}).addTo(map);
const playerRoute = L.polyline([], { 
    color: '#e74c3c', 
    weight: 5 
}).addTo(map);

// Elementos UI
const multiplayerBtn = document.getElementById('multiplayer-btn');
const multiplayerControls = document.getElementById('multiplayer-controls');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id');
const playersList = document.getElementById('players-list');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');

// Iniciar seguimiento GPS
function startTracking() {
    if (isTracking && !isPaused) return;
    
    if (!isTracking) {
        path = [];
        totalDistance = 0;
        startTime = new Date();
        playerRoute.setLatLngs([]);
        updateUI();
    }
    
    isTracking = true;
    isPaused = false;
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    
    if (trackingWatchId) {
        navigator.geolocation.clearWatch(trackingWatchId);
    }
    
    trackingWatchId = navigator.geolocation.watchPosition(
        position => {
            const coords = [position.coords.latitude, position.coords.longitude];
            updatePosition(coords, position.coords.speed);
            
            if (multiplayerMode && socket) {
                socket.emit('playerUpdate', {
                    position: coords,
                    distance: totalDistance,
                    speed: position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) : '0.0'
                });
            }
        },
        error => {
            console.error("Error GPS:", error);
            alert(`Error de GPS: ${error.message}`);
        },
        { 
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000 
        }
    );
    
    updateControlButtons();
}

function updatePosition(coords, speed) {
    // Actualizar marcador
    playerMarker.setLatLng(coords);
    
    // Calcular distancia
    if (path.length > 0) {
        const lastPos = path[path.length - 1];
        const distance = calculateDistance(...lastPos, ...coords);
        totalDistance += distance;
    }
    
    // Guardar ruta
    path.push(coords);
    playerRoute.setLatLngs(path);
    
    // Centrar mapa (suavemente)
    map.panTo(coords, { animate: true, duration: 1 });
    
    // Actualizar UI
    updateUI(speed);
}

function updateUI(speed = 0) {
    document.getElementById('distance').textContent = (totalDistance / 1000).toFixed(2) + ' km';
    document.getElementById('speed').textContent = speed ? (speed * 3.6).toFixed(1) + ' km/h' : '0.0 km/h';
}

function updateTimer() {
    if (!startTime) return;
    
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    
    document.getElementById('time').textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Resto de funciones (pauseTracking, stopTracking, calculateDistance, etc.) se mantienen igual

// Modo Multijugador
function toggleMultiplayerMode() {
    multiplayerMode = !multiplayerMode;
    multiplayerBtn.textContent = `Multijugador: ${multiplayerMode ? 'ON' : 'OFF'}`;
    multiplayerBtn.style.background = multiplayerMode ? '#2ecc71' : '#e74c3c';
    multiplayerControls.classList.toggle('hidden', !multiplayerMode);
    
    if (!multiplayerMode) {
        Object.values(otherPlayers).forEach(player => {
            map.removeLayer(player.marker);
            if (player.route) map.removeLayer(player.route);
        });
        otherPlayers = {};
        updatePlayersList();
    }
}

// Socket.io Handlers
socket.on('playerJoined', (playerId, playerData) => {
    if (!otherPlayers[playerId]) {
        const icon = L.divIcon({
            className: 'other-player-icon',
            html: `<div class="other-player-marker" style="background:${getRandomColor()}"></div>`,
            iconSize: [20, 20]
        });
        
        otherPlayers[playerId] = {
            marker: L.marker(playerData.position, { icon }).addTo(map),
            route: L.polyline([], { color: '#3498db', weight: 3 }).addTo(map),
            name: playerData.name || `Jugador ${Object.keys(otherPlayers).length + 1}`
        };
        
        updatePlayersList();
    }
});

socket.on('playerUpdate', (playerId, data) => {
    if (otherPlayers[playerId]) {
        otherPlayers[playerId].marker.setLatLng(data.position);
        const currentPath = otherPlayers[playerId].route.getLatLngs();
        currentPath.push(data.position);
        otherPlayers[playerId].route.setLatLngs(currentPath);
    }
});

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    updateControlButtons();
    
    // Solicitar permisos de geolocalización al cargar
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => map.setView([pos.coords.latitude, pos.coords.longitude], 17),
            err => console.warn("Permiso de ubicación no concedido:", err)
        );
    }
});
