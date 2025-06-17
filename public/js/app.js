// Configuración inicial del mapa
const map = L.map('map').setView([19.4326, -99.1332], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
}).addTo(map);

// Variables de estado
let path = [];
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isTracking = false;
let isPaused = false;
let trackingWatchId = null;
let multiplayerMode = false;
let otherPlayers = {};
let socket = io();

// Elementos del jugador
const playerIcon = L.divIcon({
    className: 'player-icon',
    html: '<div style="background:#e74c3c;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [26, 26]
});
const playerMarker = L.marker([0, 0], { icon: playerIcon }).addTo(map);
const playerRoute = L.polyline([], { color: '#e74c3c', weight: 5 }).addTo(map);

// Elementos UI
const multiplayerBtn = document.getElementById('multiplayer-btn');
const multiplayerControls = document.getElementById('multiplayer-controls');
const joinRoomBtn = document.getElementById('join-room');
const roomIdInput = document.getElementById('room-id');
const playersList = document.getElementById('players-list');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');

// Eventos
multiplayerBtn.addEventListener('click', toggleMultiplayerMode);
joinRoomBtn.addEventListener('click', joinRoom);
startBtn.addEventListener('click', startTracking);
pauseBtn.addEventListener('click', pauseTracking);
stopBtn.addEventListener('click', stopTracking);
zoomInBtn.addEventListener('click', () => map.zoomIn());
zoomOutBtn.addEventListener('click', () => map.zoomOut());

// Control del tracking
function startTracking() {
    if (isTracking && !isPaused) return;
    
    if (!isTracking) {
        resetTrackingData();
        startTime = new Date();
    }
    
    isTracking = true;
    isPaused = false;
    
    startTimer();
    startWatchingPosition();
    updateControlButtons();
}

function pauseTracking() {
    if (!isTracking) return;
    
    isPaused = true;
    stopWatchingPosition();
    clearInterval(timerInterval);
    updateControlButtons();
}

function stopTracking() {
    isTracking = false;
    isPaused = false;
    stopWatchingPosition();
    clearInterval(timerInterval);
    resetTrackingData();
    updateControlButtons();
}

function resetTrackingData() {
    path = [];
    totalDistance = 0;
    playerRoute.setLatLngs([]);
    updateUI();
}

function startWatchingPosition() {
    if (trackingWatchId) {
        navigator.geolocation.clearWatch(trackingWatchId);
    }
    
    trackingWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        handleGeolocationError,
        { 
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000 
        }
    );
}

function stopWatchingPosition() {
    if (trackingWatchId) {
        navigator.geolocation.clearWatch(trackingWatchId);
        trackingWatchId = null;
    }
}

function handlePositionUpdate(position) {
    const coords = [position.coords.latitude, position.coords.longitude];
    const speed = position.coords.speed || 0;
    
    updatePlayerPosition(coords, speed);
    updateMapView(coords);
    
    if (multiplayerMode && socket) {
        sendPlayerUpdate(coords, speed);
    }
}

function updatePlayerPosition(coords, speed) {
    // Calcular distancia
    if (path.length > 0) {
        const lastPos = path[path.length - 1];
        totalDistance += calculateDistance(...lastPos, ...coords);
    }
    
    // Actualizar marcador y ruta
    playerMarker.setLatLng(coords);
    path.push(coords);
    playerRoute.setLatLngs(path);
    
    // Actualizar UI
    updateUI(speed);
}

// Funciones de ayuda
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
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

function startTimer() {
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!startTime) return;
    
    const elapsed = Math.floor((new Date() - startTime) / 1000);
    document.getElementById('time').textContent = 
        `${Math.floor(elapsed / 3600).toString().padStart(2, '0')}:` +
        `${Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')}:` +
        `${(elapsed % 60).toString().padStart(2, '0')}`;
}

function updateUI(speed = 0) {
    document.getElementById('distance').textContent = (totalDistance / 1000).toFixed(2) + ' km';
    document.getElementById('speed').textContent = (speed * 3.6).toFixed(1) + ' km/h';
}

function updateMapView(coords) {
    if (!isPaused) {
        map.setView(coords, map.getZoom(), {
            animate: true,
            duration: 0.5
        });
    }
}

function updateControlButtons() {
    startBtn.disabled = isTracking && !isPaused;
    pauseBtn.disabled = !isTracking || isPaused;
    stopBtn.disabled = !isTracking;
    
    startBtn.innerHTML = isTracking && isPaused ? 
        '<i class="fas fa-redo"></i> Reanudar' : 
        '<i class="fas fa-play"></i> Inicio';
}

// Funciones multijugador
function toggleMultiplayerMode() {
    multiplayerMode = !multiplayerMode;
    
    multiplayerBtn.textContent = `Multijugador: ${multiplayerMode ? 'ON' : 'OFF'}`;
    multiplayerBtn.style.background = multiplayerMode ? '#2ecc71' : '#e74c3c';
    multiplayerControls.classList.toggle('hidden', !multiplayerMode);
    
    if (!multiplayerMode) {
        clearOtherPlayers();
    } else if (!isTracking) {
        startTracking();
    }
}

function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (roomId && socket) {
        socket.emit('joinRoom', roomId);
    } else {
        alert("Por favor ingresa un ID de sala válido");
    }
}

function clearOtherPlayers() {
    Object.values(otherPlayers).forEach(player => {
        map.removeLayer(player.marker);
        if (player.route) map.removeLayer(player.route);
    });
    otherPlayers = {};
    updatePlayersList();
}

function sendPlayerUpdate(coords, speed) {
    socket.emit('playerUpdate', {
        position: coords,
        distance: totalDistance,
        speed: (speed * 3.6).toFixed(1)
    });
}

// Socket.io Handlers
socket.on('playerJoined', (playerId, playerData) => {
    if (!otherPlayers[playerId]) {
        const icon = L.divIcon({
            className: 'other-player-icon',
            html: '<div style="background:#3498db;width:18px;height:18px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
            iconSize: [22, 22]
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

socket.on('playerLeft', (playerId) => {
    if (otherPlayers[playerId]) {
        map.removeLayer(otherPlayers[playerId].marker);
        if (otherPlayers[playerId].route) {
            map.removeLayer(otherPlayers[playerId].route);
        }
        delete otherPlayers[playerId];
        updatePlayersList();
    }
});

function updatePlayersList() {
    playersList.innerHTML = '';
    Object.entries(otherPlayers).forEach(([id, player]) => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        playerElement.textContent = player.name;
        playersList.appendChild(playerElement);
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    updateControlButtons();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => map.setView([pos.coords.latitude, pos.coords.longitude], 17),
            err => console.warn("Permiso de ubicación no concedido:", err)
        );
    }
});
