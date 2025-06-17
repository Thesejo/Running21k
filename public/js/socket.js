let socket = io();

socket.on('connect', () => {
    console.log('Conectado al servidor Socket.io');
});

socket.on('roomJoined', (roomId) => {
    alert(`Unido a la sala: ${roomId}`);
});

socket.on('playerJoined', (playerId, playerData) => {
    if (!otherPlayers[playerId]) {
        // Crear marcador para el nuevo jugador
        const marker = L.marker(playerData.position, { icon: otherPlayerIcon }).addTo(map);
        const route = L.polyline([], { color: '#3498db', weight: 3 }).addTo(map);
        
        otherPlayers[playerId] = {
            marker,
            route,
            name: playerData.name || `Jugador ${Object.keys(otherPlayers).length + 1}`
        };
        
        updatePlayersList();
    }
});

socket.on('playerUpdate', (playerId, data) => {
    if (otherPlayers[playerId]) {
        // Actualizar posición del jugador
        otherPlayers[playerId].marker.setLatLng(data.position);
        
        // Actualizar ruta si existe
        if (otherPlayers[playerId].route) {
            const currentPath = otherPlayers[playerId].route.getLatLngs();
            currentPath.push(data.position);
            otherPlayers[playerId].route.setLatLngs(currentPath);
        }
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
