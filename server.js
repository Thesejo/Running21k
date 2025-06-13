const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Almacenamiento en memoria
const races = {};
const MAX_RACE_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint básico
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Limpiar carreras antiguas periódicamente
setInterval(cleanupOldRaces, 60 * 60 * 1000); // Cada hora

// Configurar Socket.io
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado:', socket.id);
    
    socket.on('createRace', ({ userId, userName }) => {
        const raceId = generateRaceCode();
        races[raceId] = {
            id: raceId,
            created: new Date(),
            participants: {
                [userId]: { name: userName, joined: new Date() }
            },
            positions: {},
            spectators: []
        };
        
        socket.join(raceId);
        socket.emit('raceCreated', { raceId });
        updateRaceParticipants(raceId);
    });
    
    socket.on('joinRace', ({ raceId, userId, userName }) => {
        if (!races[raceId]) {
            return socket.emit('error', { message: 'Carrera no encontrada' });
        }
        
        races[raceId].participants[userId] = { 
            name: userName, 
            joined: new Date() 
        };
        
        socket.join(raceId);
        socket.emit('raceJoined', { raceId });
        updateRaceParticipants(raceId);
    });
    
    socket.on('spectateRace', ({ raceId, userId }) => {
        if (!races[raceId]) {
            return socket.emit('error', { message: 'Carrera no encontrada' });
        }
        
        if (!races[raceId].spectators.includes(userId)) {
            races[raceId].spectators.push(userId);
        }
        
        socket.join(raceId);
        socket.emit('spectatorJoined', { raceId });
        updateRaceParticipants(raceId);
    });
    
    socket.on('updatePosition', (positionData) => {
        const { raceId, userId, lat, lng } = positionData;
        
        if (!races[raceId]) {
            return socket.emit('error', { message: 'Carrera no encontrada' });
        }
        
        races[raceId].positions[userId] = { 
            lat, 
            lng,
            timestamp: new Date(),
            speed: positionData.speed,
            distance: positionData.distance
        };
        
        // Enviar actualización a todos en la carrera
        io.to(raceId).emit('positionUpdate', { 
            positions: races[raceId].positions 
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
        // Podrías añadir lógica para manejar desconexiones aquí
    });
});

function updateRaceParticipants(raceId) {
    if (!races[raceId]) return;
    
    io.to(raceId).emit('participantsUpdate', {
        participants: races[raceId].participants
    });
}

function cleanupOldRaces() {
    const now = new Date();
    const threshold = new Date(now - MAX_RACE_AGE_MS);
    
    for (const raceId in races) {
        if (new Date(races[raceId].created) < threshold) {
            delete races[raceId];
            console.log(`Carrera ${raceId} eliminada por inactividad`);
        }
    }
}

function generateRaceCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (races[code]);
    return code;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});