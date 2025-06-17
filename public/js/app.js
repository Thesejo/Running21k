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
let multiplayerMode = false;
let watchId = null;

// Elementos UI
const playerIcon = L.divIcon({
    className: 'player-icon',
    html: '<div style="background:#e74c3c;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
    iconSize: [26, 26]
});

const playerMarker = L.marker([0, 0], { icon: playerIcon }).addTo(map);
const playerRoute = L.polyline([], { color: '#e74c3c', weight: 5 }).addTo(map);

// Botones de control
function setupUI() {
    // Botones de tracking
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    startBtn.addEventListener('click', startTracking);
    pauseBtn.addEventListener('click', togglePause);
    stopBtn.addEventListener('click', stopTracking);
    
    // Botones de zoom
    document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
    
    // Botón centrar
    document.getElementById('center-btn').addEventListener('click', () => {
        if (playerMarker.getLatLng().lat !== 0) {
            map.setView(playerMarker.getLatLng(), 17);
        }
    });
}

// Funciones de tracking
function startTracking() {
    if (!isTracking) {
        isTracking = true;
        isPaused = false;
        startTime = new Date();
        path = [];
        totalDistance = 0;
        
        document.getElementById('start-btn').disabled = true;
        document.getElementById('pause-btn').disabled = false;
        document.getElementById('stop-btn').disabled = false;
        
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
        
        watchId = navigator.geolocation.watchPosition(
            updatePosition,
            handleGeolocationError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
}

function togglePause() {
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pause-btn');
    
    if (isPaused) {
        clearInterval(timerInterval);
        navigator.geolocation.clearWatch(watchId);
        pauseBtn.innerHTML = '<i class="fas fa-play"></i> Reanudar';
    } else {
        startTime = new Date(new Date() - (new Date() - startTime));
        watchId = navigator.geolocation.watchPosition(
            updatePosition,
            handleGeolocationError,
            { enableHighAccuracy: true }
        );
        timerInterval = setInterval(updateTimer, 1000);
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
    }
}

function stopTracking() {
    isTracking = false;
    isPaused = false;
    
    clearInterval(timerInterval);
    navigator.geolocation.clearWatch(watchId);
    
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('pause-btn').innerHTML = '<i class="fas fa-pause"></i> Pausar';
    
    saveRoute();
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupUI();
    startTracking(); // Auto-iniciar al cargar (opcional)
});
