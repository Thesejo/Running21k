// Configuración inicial del mapa
const map = L.map('map').setView([19.4326, -99.1332], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Variables del corredor
let path = [];
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isTracking = false;
let isPaused = false;
let trackingInterval = null;
let multiplayerMode = false;

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

// Iniciar seguimiento GPS
function startTracking() {
    if (navigator.geolocation) {
        isTracking = true;
        isPaused = false;
        
        if (!startTime) {
            startTime = new Date();
        }
        
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        
        trackingInterval = navigator.geolocation.watchPosition(
            updatePosition,
            handleGeolocationError,
            { 
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000 
            }
        );
        
        updateControlButtons();
    } else {
        alert("Tu navegador no soporta geolocalización.");
    }
}

function pauseTracking() {
    isPaused = true;
    if (trackingInterval) {
        navigator.geolocation.clearWatch(trackingInterval);
        trackingInterval = null;
    }
    clearInterval(timerInterval);
    updateControlButtons();
}

function stopTracking() {
    pauseTracking();
    isTracking = false;
    startTime = null;
    path = [];
    totalDistance = 0;
    playerRoute.setLatLngs([]);
    document.getElementById('distance').textContent = '0.00 km';
    document.getElementById('speed').textContent = '0.0 km/h';
    document.getElementById('time').textContent = '00:00:00';
    updateControlButtons();
}

function updateControlButtons() {
    startBtn.disabled = isTracking && !isPaused;
    pauseBtn.disabled = !isTracking || isPaused;
    stopBtn.disabled = !isTracking;
    
    if (!isTracking) {
        startBtn.innerHTML = '<i class="fas fa-play"></i> Inicio';
    } else {
        startBtn.innerHTML = '<i class="fas fa-redo"></i> Reanudar';
    }
}

// Resto del código manteniendo todas las funciones originales...
// (updatePosition, calculateDistance, updateTimer, handleGeolocationError, 
// toggleMultiplayerMode, joinRoom, updatePlayersList, etc.)

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    updateControlButtons();
    // Centrar mapa en ubicación del usuario si está disponible
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 17);
        });
    }
});
