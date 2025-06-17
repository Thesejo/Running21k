const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración básica
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Manejo de salas multijugador
const rooms = {};

io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // Unirse a una sala
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = { players: {} };
        }

        socket.join(roomId);
        rooms[roomId].players[socket.id] = { position: [0, 0] };
        
        // Notificar al cliente
        socket.emit('roomJoined', roomId);
        
        // Notificar a otros jugadores
        socket.to(roomId).emit('playerJoined', socket.id, rooms[roomId].players[socket.id]);
        
        // Enviar lista de jugadores al nuevo miembro
        io.to(socket.id).emit('currentPlayers', rooms[roomId].players);
    });

    // Actualización de posición
    socket.on('playerUpdate', (data) => {
        const roomId = [...socket.rooms][1]; // Obtener la sala (el primer room es el propio socket.id)
        
        if (roomId && rooms[roomId]?.players[socket.id]) {
            rooms[roomId].players[socket.id] = {
                ...rooms[roomId].players[socket.id],
                position: data.position,
                distance: data.distance,
                speed: data.speed
            };
            
            // Transmitir a otros jugadores
            socket.to(roomId).emit('playerUpdate', socket.id, data);
        }
    });

    // Desconexión
    socket.on('disconnect', () => {
        const roomId = [...socket.rooms][1];
        
        if (roomId && rooms[roomId]?.players[socket.id]) {
            // Notificar a otros jugadores
            socket.to(roomId).emit('playerLeft', socket.id);
            
            // Eliminar de la sala
            delete rooms[roomId].players[socket.id];
            
            // Eliminar sala si está vacía
            if (Object.keys(rooms[roomId].players).length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
