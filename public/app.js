// Variables globales
let mapRunner, mapSpectator;
let currentPositionMarker = null;
let pathCoordinates = [];
let pathLayer = null;
let watchId = null;
let startTime = null;
let timerInterval = null;
let distance = 0;
let raceId = null;
let isSpectator = false;
let participants = {};
let socket = io();
let userId = generateUserId();
let userName = 'Corredor ' + Math.floor(Math.random() * 1000);
let participantSources = {};
let participantLayers = {};

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    initMaps();
    setupEventListeners();
    setupSocketListeners();
});

function initMaps() {
    // Mapa para el corredor
    mapRunner = new maplibregl.Map({
        container: 'runnerMap',
        style: 'https://demotiles.maplibre.org/style.json', // Estilo básico
        center: [-99.1332, 19.4326], // Centro en CDMX [lng, lat]
        zoom: 12
    });

    // Mapa para espectador (inicialmente oculto)
    mapSpectator = new maplibregl.Map({
        container: 'spectatorMap',
        style: 'https://demotiles.maplibre.org/style.json',
        center: [-99.1332, 19.4326],
        zoom: 12
    });

    // Añadir controles de navegación
    mapRunner.addControl(new maplibregl.NavigationControl());
    mapSpectator.addControl(new maplibregl.NavigationControl());

    // Intenta obtener la ubicación actual al inicio
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const pos = [position.coords.longitude, position.coords.latitude];
            
            mapRunner.setCenter(pos);
            mapSpectator.setCenter(pos);
            
            // Crear marcador inicial
            createRunnerMarker(pos);
        });
    }

    // Añadir fuente y capa para la ruta
    mapRunner.on('load', function() {
        mapRunner.addSource('route', {
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

        mapRunner.addLayer({
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

    mapSpectator.on('load', function() {
        // Configuración similar para el mapa del espectador
    });
}

function createRunnerMarker(pos) {
    if (currentPositionMarker) {
        currentPositionMarker.setLngLat(pos);
        return;
    }

    const el = document.createElement('div');
    el.className = 'runner-marker';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.backgroundColor = '#4264fb';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';

    currentPositionMarker = new maplibregl.Marker({
        element: el
    }).setLngLat(pos).addTo(mapRunner);
}

function setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', startTracking);
    document.getElementById('stopBtn').addEventListener('click', stopTracking);
    document.getElementById('multiplayerBtn').addEventListener('click', toggleMultiplayerPanel);
    document.getElementById('joinRaceBtn').addEventListener('click', joinRace);
    document.getElementById('createRaceBtn').addEventListener('click', createRace);
    document.getElementById('spectateRaceBtn').addEventListener('click', spectateRace);
}

function setupSocketListeners() {
    socket.on('participantsUpdate', (data) => {
        participants = data.participants;
        updateParticipantsList();
    });
    
    socket.on('positionUpdate', (data) => {
        updateParticipantsPositions(data.positions);
    });
    
    socket.on('raceCreated', (data) => {
        raceId = data.raceId;
        document.getElementById('raceCode').value = raceId;
        alert(`Carrera creada! Código: ${raceId}\nComparte este código con otros participantes.`);
    });
    
    socket.on('raceJoined', (data) => {
        raceId = data.raceId;
        alert('Te has unido a la carrera!');
        document.getElementById('multiplayerPanel').classList.add('hidden');
    });
    
    socket.on('spectatorJoined', (data) => {
        raceId = data.raceId;
        isSpectator = true;
        document.getElementById('runnerMap').classList.add('hidden');
        document.getElementById('spectatorMap').classList.remove('hidden');
        alert('Modo espectador activado!');
        document.getElementById('multiplayerPanel').classList.add('hidden');
    });
    
    socket.on('error', (error) => {
        alert(`Error: ${error.message}`);
    });
}

function startTracking() {
    if (watchId !== null) return;
    
    // Reiniciar estadísticas
    distance = 0;
    pathCoordinates = [];
    startTime = new Date();
    document.getElementById('distance').textContent = '0.00';
    document.getElementById('speed').textContent = '0.00';
    
    // Iniciar temporizador
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
    
    // Comenzar a seguir la ubicación
    watchId = navigator.geolocation.watchPosition(
        updatePosition,
        handleGeolocationError,
        {enableHighAccuracy: true, maximumAge: 10000, timeout: 5000}
    );
    
    // Actualizar UI
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    // Si estamos en una carrera, notificar a otros participantes
    if (raceId) {
        updateRacePosition();
    }
}

function stopTracking() {
    if (watchId === null) return;
    
    // Detener el seguimiento
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    
    // Detener el temporizador
    clearInterval(timerInterval);
    timerInterval = null;
    
    // Actualizar UI
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    
    // Mostrar resumen de la carrera
    alert(`Carrera completada!\nDistancia: ${document.getElementById('distance').textContent} km\nTiempo: ${document.getElementById('time').textContent}`);
}

function updatePosition(position) {
    const pos = [position.coords.longitude, position.coords.latitude];
    
    // Actualizar marcador de posición
    createRunnerMarker(pos);
    
    // Centrar mapa en la posición actual (solo para corredor)
    if (!isSpectator) {
        mapRunner.flyTo({center: pos});
    }
    
    // Calcular distancia si hay puntos anteriores
    if (pathCoordinates.length > 0) {
        const lastPos = pathCoordinates[pathCoordinates.length - 1];
        const segmentDistance = calculateDistance(lastPos[1], lastPos[0], pos[1], pos[0]);
        
        distance += segmentDistance;
        document.getElementById('distance').textContent = distance.toFixed(2);
    }
    
    // Actualizar velocidad
    document.getElementById('speed').textContent = (position.coords.speed * 3.6 || 0).toFixed(2);
    
    // Añadir punto al recorrido
    pathCoordinates.push(pos);
    
    // Dibujar la ruta
    drawPath();
    
    // Actualizar posición en la carrera multijugador
    if (raceId) {
        updateRacePosition();
    }
}

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

function drawPath() {
    if (!mapRunner.getSource('route')) return;
    
    mapRunner.getSource('route').setData({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: pathCoordinates
        }
    });
}

function updateTimer() {
    const now = new Date();
    const elapsed = new Date(now - startTime);
    
    const hours = elapsed.getUTCHours().toString().padStart(2, '0');
    const minutes = elapsed.getUTCMinutes().toString().padStart(2, '0');
    const seconds = elapsed.getUTCSeconds().toString().padStart(2, '0');
    
    document.getElementById('time').textContent = `${hours}:${minutes}:${seconds}`;
}

function handleGeolocationError(error) {
    console.error('Error de geolocalización:', error);
    alert('Error al obtener la ubicación: ' + error.message);
}

function toggleMultiplayerPanel() {
    const panel = document.getElementById('multiplayerPanel');
    panel.classList.toggle('hidden');
}

function createRace() {
    socket.emit('createRace', { userId, userName });
}

function joinRace() {
    const code = document.getElementById('raceCode').value.trim();
    
    if (!code) {
        alert('Por favor ingresa un código de carrera');
        return;
    }
    
    socket.emit('joinRace', { 
        raceId: code, 
        userId, 
        userName 
    });
}

function spectateRace() {
    const code = document.getElementById('raceCode').value.trim();
    
    if (!code) {
        alert('Por favor ingresa un código de carrera');
        return;
    }
    
    socket.emit('spectateRace', { 
        raceId: code, 
        userId 
    });
}

function updateParticipantsList() {
    const listElement = document.getElementById('participantsList');
    listElement.innerHTML = '';
    
    for (const [id, data] of Object.entries(participants)) {
        const participantElement = document.createElement('div');
        participantElement.textContent = data.name || id;
        if (id === userId) {
            participantElement.textContent += ' (Tú)';
            participantElement.style.fontWeight = 'bold';
        }
        listElement.appendChild(participantElement);
    }
}

function updateParticipantsPositions(positions) {
    // Para cada participante, actualizar o crear su marcador
    for (const [id, posData] of Object.entries(positions)) {
        if (id === userId) continue; // Saltar el propio marcador

        const pos = [posData.lng, posData.lat];
        const mapTarget = isSpectator ? mapSpectator : mapRunner;

        if (!participantSources[id]) {
            // Crear fuente y capa para el participante
            participantSources[id] = `participant-${id}`;
            
            mapTarget.addSource(participantSources[id], {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: pos
                        }
                    }]
                }
            });

            mapTarget.addLayer({
                id: `participant-layer-${id}`,
                type: 'circle',
                source: participantSources[id],
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#EA4335',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                }
            });

            participantLayers[id] = `participant-layer-${id}`;
        } else {
            // Actualizar posición existente
            mapTarget.getSource(participantSources[id]).setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: pos
                    }
                }]
            });
        }
    }

    // Eliminar participantes que ya no están
    for (const id in participantSources) {
        if (!positions[id] && id !== userId) {
            const mapTarget = isSpectator ? mapSpectator : mapRunner;
            if (mapTarget.getLayer(participantLayers[id])) {
                mapTarget.removeLayer(participantLayers[id]);
            }
            if (mapTarget.getSource(participantSources[id])) {
                mapTarget.removeSource(participantSources[id]);
            }
            delete participantSources[id];
            delete participantLayers[id];
        }
    }

    // Centrar mapa espectador en el grupo de participantes
    if (isSpectator && Object.keys(positions).length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const pos of Object.values(positions)) {
            bounds.extend([pos.lng, pos.lat]);
        }
        mapSpectator.fitBounds(bounds, { padding: 50 });
    }
}

function updateRacePosition() {
    if (!raceId || !currentPositionMarker) return;
    
    const pos = currentPositionMarker.getLngLat();
    const positionData = {
        raceId,
        userId,
        lat: pos.lat,
        lng: pos.lng,
        speed: parseFloat(document.getElementById('speed').textContent),
        distance: parseFloat(document.getElementById('distance').textContent)
    };
    
    socket.emit('updatePosition', positionData);
}

function generateUserId() {
    return 'user_' + Math.random().toString(36).substring(2, 9);
}

// Configuración PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registrado con éxito: ', registration.scope);
        }).catch(err => {
            console.log('Error al registrar ServiceWorker: ', err);
        });
    });
}
