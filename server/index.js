const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? 'https://numberwars.vercel.app'  // Production URL only
            : '*',  // Allow any origin in development
        methods: ['GET', 'POST']
    }
});
// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

// Store rooms and their game states
const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('createRoom', (callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [socket.id],
            gameState: {
                grid: Array(81).fill().map(() => Math.floor(Math.random() * 10)), // 0-9
                currentPlayer: 'red',
                scores: { red: 0, blue: 0 },
                numberUsage: {
                    red: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 },
                    blue: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 }
                },
                selectedCells: [],
                currentExpression: [],
                timeLeft: 120
            }
        };
        socket.join(roomCode);
        socket.emit('playerRole', 'red');
        callback(roomCode);
        io.to(roomCode).emit('gameState', rooms[roomCode].gameState);
        console.log(`Room created: ${roomCode} by ${socket.id}`);
    });

    socket.on('joinRoom', (roomCode, callback) => {
        roomCode = roomCode.toUpperCase();
        if (rooms[roomCode]) {
            if (rooms[roomCode].players.length < 2) {
                clearTimeout(rooms[roomCode].timeout);
                rooms[roomCode].players.push(socket.id);
                socket.join(roomCode);
                socket.emit('playerRole', 'blue');
                io.to(roomCode).emit('gameState', rooms[roomCode].gameState);
                callback({ success: true });
            } else if (rooms[roomCode].players.includes(socket.id)) {
                // Rejoin
                socket.join(roomCode);
                const role = rooms[roomCode].players[0] === socket.id ? 'red' : 'blue';
                socket.emit('playerRole', role);
                io.to(roomCode).emit('gameState', rooms[roomCode].gameState);
                callback({ success: true });
            } else {
                callback({ success: false, message: 'Room is full' });
            }
        } else {
            callback({ success: false, message: 'Room does not exist' });
        }
    });

    socket.on('selectCell', ({ roomCode, index }) => {
        if (rooms[roomCode] && rooms[roomCode].players.includes(socket.id)) {
            const gameState = rooms[roomCode].gameState;
            const playerRole = rooms[roomCode].players.indexOf(socket.id) === 0 ? 'red' : 'blue';
            if (gameState.currentPlayer === playerRole && !gameState.selectedCells.includes(index)) {
                gameState.selectedCells.push(index);
                io.to(roomCode).emit('gameState', gameState);
            }
        }
    });

    socket.on('submitEquation', ({ roomCode, expression }) => {
        if (rooms[roomCode] && rooms[roomCode].players.includes(socket.id)) {
            const gameState = rooms[roomCode].gameState;
            const playerRole = rooms[roomCode].players.indexOf(socket.id) === 0 ? 'red' : 'blue';
            if (gameState.currentPlayer === playerRole) {
                gameState.currentExpression = expression;
                io.to(roomCode).emit('gameState', gameState);
            }
        }
    });

    socket.on('validateAndSubmit', ({ roomCode, expression, selectedCells }) => {
        if (rooms[roomCode] && rooms[roomCode].players.includes(socket.id)) {
            const gameState = rooms[roomCode].gameState;
            const playerRole = rooms[roomCode].players.indexOf(socket.id) === 0 ? 'red' : 'blue';
            if (gameState.currentPlayer !== playerRole) return;

            // Server-side validation
            const isValid = validateEquation(expression, selectedCells, gameState.grid);
            if (isValid) {
                // Capture cells
                selectedCells.forEach((index) => {
                    gameState.grid[index] = { value: gameState.grid[index], owner: playerRole };
                });
                gameState.scores[playerRole] += selectedCells.length;

                // Update number usage
                expression.forEach((token) => {
                    const num = parseInt(token);
                    if (!isNaN(num) && gameState.numberUsage[playerRole][num]) {
                        gameState.numberUsage[playerRole][num]--;
                    }
                });

                // Switch player
                gameState.currentPlayer = playerRole === 'red' ? 'blue' : 'red';
                gameState.selectedCells = [];
                gameState.currentExpression = [];
                gameState.timeLeft = 120;

                // Check win condition
                const totalCells = 81;
                const capturedCells = Object.values(gameState.grid).filter(cell => cell.owner).length;
                if (capturedCells === totalCells) {
                    const winner = gameState.scores.red > gameState.scores.blue ? 'red' : 'blue';
                    io.to(roomCode).emit('gameOver', { winner });
                }
            }
            io.to(roomCode).emit('gameState', gameState);
            socket.emit('submitResult', { success: isValid });
        }
    });

    socket.on('clearSelection', ({ roomCode }) => {
        if (rooms[roomCode] && rooms[roomCode].players.includes(socket.id)) {
            const gameState = rooms[roomCode].gameState;
            const playerRole = rooms[roomCode].players.indexOf(socket.id) === 0 ? 'red' : 'blue';
            if (gameState.currentPlayer === playerRole) {
                gameState.selectedCells = [];
                gameState.currentExpression = [];
                io.to(roomCode).emit('gameState', gameState);
            }
        }
    });

    socket.on('updateTimer', ({ roomCode, timeLeft }) => {
        if (rooms[roomCode] && rooms[roomCode].players.includes(socket.id)) {
            const gameState = rooms[roomCode].gameState;
            const playerRole = rooms[roomCode].players.indexOf(socket.id) === 0 ? 'red' : 'blue';
            if (gameState.currentPlayer === playerRole) {
                gameState.timeLeft = timeLeft;
                if (timeLeft <= 0) {
                    gameState.currentPlayer = playerRole === 'red' ? 'blue' : 'red';
                    gameState.selectedCells = [];
                    gameState.currentExpression = [];
                    gameState.timeLeft = 120;
                }
                io.to(roomCode).emit('gameState', gameState);
            }
        }
    });

    socket.on('disconnect', () => {
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                } else {
                    io.to(roomCode).emit('playerDisconnected');
                }
                console.log(`Player ${socket.id} disconnected from room ${roomCode}`);
            }
        }
    });
});

function validateEquation(expression, selectedCells, grid) {
    if (expression.length < 3 || selectedCells.length < 2) return false;
    const operatorMap = { '×': '*', '÷': '/', '+': '+', '-': '-' };
    let jsExpression = expression.map(token => operatorMap[token] || token).join(' ');
    try {
        const result = eval(jsExpression);
        const selectedValues = selectedCells.map(index => grid[index].value || grid[index]);
        const targetNumber = Number(selectedValues.join(''));
        return result === targetNumber;
    } catch (e) {
        console.error('Equation evaluation error:', e);
        return false;
    }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});