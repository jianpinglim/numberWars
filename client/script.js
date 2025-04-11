import { io } from '/socket.io/socket.io.esm.min.js';

const socket = io('https://numberwars.onrender.com');

const game = {
    gridSize: 9,
    currentPlayer: 'red',
    playerRole: null,
    roomCode: null,
    grid: [],
    selectedCells: [],
    currentExpression: [],
    timeLeft: 120,
    timer: null,
    numberUsage: {
        saved: {
            red: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 },
            blue: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 }
        },
        current: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
    },
    scores: { red: 0, blue: 0 },

    init() {
        this.setupRoomInterface();
        this.setupSocketListeners();
    },

    setupRoomInterface() {
        const savedRoomCode = sessionStorage.getItem('roomCode');
        if (savedRoomCode) {
            socket.emit('joinRoom', savedRoomCode, (response) => {
                if (response.success) {
                    this.roomCode = savedRoomCode;
                    document.getElementById('roomInterface').style.display = 'none';
                    document.getElementById('gameInterface').style.display = 'block';
                    this.updateHeader();
                    this.setupEventListeners();
                } else {
                    // If rejoin fails (e.g., room closed), clear sessionStorage
                    sessionStorage.removeItem('roomCode');
                }
            });
        }

        document.getElementById('roomInterface').style.display = 'block';
        document.getElementById('gameInterface').style.display = 'none';

        document.getElementById('createRoom').addEventListener('click', () => {
            socket.emit('createRoom', (roomCode) => {
                this.roomCode = roomCode;
                sessionStorage.setItem('roomCode', roomCode); // Changed to sessionStorage
                alert(`Room created! Code: ${roomCode}`);
                document.getElementById('roomInterface').style.display = 'none';
                document.getElementById('gameInterface').style.display = 'block';
                this.updateHeader();
                this.setupEventListeners();
            });
        });

        document.getElementById('joinRoom').addEventListener('click', () => {
            const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
            if (!roomCode) {
                alert('Please enter a room code');
                return;
            }
            socket.emit('joinRoom', roomCode, (response) => {
                if (response.success) {
                    this.roomCode = roomCode;
                    sessionStorage.setItem('roomCode', roomCode);
                    document.getElementById('roomInterface').style.display = 'none';
                    document.getElementById('gameInterface').style.display = 'block';
                    this.updateHeader();
                    this.setupEventListeners();
                } else {
                    alert(response.message);
                }
            });
        });

        document.getElementById('copyRoomCode').addEventListener('click', () => {
            navigator.clipboard.writeText(this.roomCode)
        });
    },

    setupSocketListeners() {
        socket.on('connect', () => {
            console.log('Connected to server:', socket.id);
        });

        socket.on('playerRole', (role) => {
            this.playerRole = role;
            this.updateHeader();
            console.log(`Assigned role: ${role}`);
        });

        socket.on('gameState', (gameState) => {
            this.currentPlayer = gameState.currentPlayer;
            this.grid = gameState.grid;
            this.scores = gameState.scores;
            this.numberUsage.saved = gameState.numberUsage;
            this.selectedCells = gameState.selectedCells;
            this.currentExpression = gameState.currentExpression;
            this.timeLeft = gameState.timeLeft;

            // Reset current number usage when state updates from server
            this.numberUsage.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };

            // Recalculate current usage based on expression
            this.currentExpression.forEach(item => {
                if (!isNaN(parseInt(item))) {
                    this.numberUsage.current[parseInt(item)]++;
                }
            });

            this.updateDisplay();
            this.renderGrid();
            document.body.style.backgroundColor = this.currentPlayer === 'red' ? 'rgb(224, 101, 101)' : 'rgb(101, 140, 224)';
            if (this.playerRole === this.currentPlayer && !this.timer) {
                this.startTimer();
            } else if (this.playerRole !== this.currentPlayer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        });

        socket.on('submitResult', ({ success }) => {
            if (!success) {
                alert('Check your equation! LOL');
            } else {
                // Reset local number usage after successful submission to sync with server
                this.numberUsage.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
            }
        });

        socket.on('gameOver', ({ winner }) => {
            alert(`Game Over! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
            this.resetGame();
        });

        socket.on('playerDisconnected', () => {
            alert('Opponent disconnected!');
            this.resetGame();
        });
    },

    setupEventListeners() {
        document.querySelectorAll('[data-number]').forEach(btn => {
            btn.removeEventListener('click', this.handleNumberClick);
            btn.addEventListener('click', this.handleNumberClick.bind(this));
        });

        document.querySelectorAll('.operators button').forEach(btn => {
            btn.removeEventListener('click', this.handleOperatorClick);
            btn.addEventListener('click', this.handleOperatorClick.bind(this));
        });

        document.getElementById('submit').removeEventListener('click', this.handleSubmit);
        document.getElementById('submit').addEventListener('click', this.handleSubmit.bind(this));
        document.getElementById('clear').removeEventListener('click', this.handleClear);
        document.getElementById('clear').addEventListener('click', this.handleClear.bind(this));
    },

    handleNumberClick(e) {
        if (this.playerRole !== this.currentPlayer) return;
        const num = parseInt(e.target.dataset.number);
        if (this.canUseNumber(num)) {
            // Add the number to the expression
            this.currentExpression.push(num.toString());
            // Track its usage locally
            this.numberUsage.current[num]++;
            // Update the server
            socket.emit('submitEquation', { roomCode: this.roomCode, expression: this.currentExpression });
            // Update the display immediately
            this.updateDisplay();
        }
    },

    handleOperatorClick(e) {
        if (this.playerRole !== this.currentPlayer) return;
        // Prevent adding operator at the beginning or after another operator
        const lastItem = this.currentExpression[this.currentExpression.length - 1];
        if (!lastItem || isNaN(parseInt(lastItem))) {
            return; // Don't allow operator at start or consecutive operators
        }

        const operator = e.target.textContent;
        this.currentExpression.push(operator);
        socket.emit('submitEquation', { roomCode: this.roomCode, expression: this.currentExpression });
        this.updateDisplay(); // Update display immediately
    },

    handleSubmit() {
        if (this.playerRole !== this.currentPlayer) return;
        socket.emit('validateAndSubmit', {
            roomCode: this.roomCode,
            expression: this.currentExpression,
            selectedCells: this.selectedCells
        });
    },

    handleClear() {
        if (this.playerRole !== this.currentPlayer) return;
        // Reset local number usage tracking when clearing
        this.numberUsage.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
        socket.emit('clearSelection', { roomCode: this.roomCode });
    },

    updateDisplay() {
        document.getElementById('currentPlayer').textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        document.getElementById('timeLeft').textContent = this.timeLeft;
        document.getElementById('redScore').textContent = this.scores.red;
        document.getElementById('blueScore').textContent = this.scores.blue;
        document.getElementById('currentEquation').textContent = this.currentExpression.join(' ');
        // Fix currentSelection to always show cell values correctly
        document.getElementById('currentSelection').textContent = this.selectedCells.map(index => {
            const cell = this.grid[index];
            // Handle both object (post-capture) and number (pre-capture) cases
            return cell && typeof cell === 'object' && 'value' in cell ? cell.value : (cell || '');
        }).join('');
        this.updateNumberButtons();
    },

    updateHeader() {
        document.getElementById('roomCodeText').textContent = this.roomCode || '?';
        document.getElementById('playerRole').textContent = this.playerRole ?
            (this.playerRole.charAt(0).toUpperCase() + this.playerRole.slice(1)) : '?';
        document.getElementById('playerRole').style.color = this.playerRole === 'red' ? '#ff4444' : '#4444ff';
    },

    renderGrid() {
        const gridElement = document.getElementById('gameGrid');
        gridElement.innerHTML = '';
        this.grid.forEach((cell, i) => {
            const div = document.createElement('div');
            div.className = 'cell';
            // Consistently display cell value, whether it's a number or an object
            div.textContent = typeof cell === 'object' && 'value' in cell ? cell.value : cell;
            div.dataset.index = i;
            if (this.selectedCells.includes(i)) div.classList.add('selected');
            if (cell && typeof cell === 'object' && cell.owner) div.classList.add(cell.owner);
            gridElement.appendChild(div);
        });
        this.setupGridListeners();
    },

    setupGridListeners() {
        const gridElement = document.getElementById('gameGrid');
        gridElement.removeEventListener('click', this.handleGridClick);
        gridElement.addEventListener('click', this.handleGridClick.bind(this));
    },

    handleGridClick(e) {
        if (!e.target.classList.contains('cell') || this.playerRole !== this.currentPlayer) return;
        const index = parseInt(e.target.dataset.index);
        if (e.target.classList.contains('red') || e.target.classList.contains('blue')) return;
        if (this.isValidSelection(index)) {
            socket.emit('selectCell', { roomCode: this.roomCode, index });
        }
    },

    startTimer() {
        clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.playerRole === this.currentPlayer) {
                this.timeLeft--;
                socket.emit('updateTimer', { roomCode: this.roomCode, timeLeft: this.timeLeft });
            }
        }, 1000);
    },

    canUseNumber(num) {
        return this.numberUsage.saved[this.playerRole][num] - this.numberUsage.current[num] > 0;
    },

    updateNumberButtons() {
        document.querySelectorAll('[data-number]').forEach(btn => {
            const num = parseInt(btn.dataset.number);
            const remaining = this.numberUsage.saved[this.playerRole][num] - this.numberUsage.current[num];
            btn.querySelector('span').textContent = remaining;
            btn.disabled = remaining <= 0 || this.playerRole !== this.currentPlayer;
        });
        document.querySelectorAll('.operators button').forEach(btn => {
            btn.disabled = this.playerRole !== this.currentPlayer;
        });
        document.getElementById('submit').disabled = this.playerRole !== this.currentPlayer;
        document.getElementById('clear').disabled = this.playerRole !== this.currentPlayer;
    },

    isValidSelection(index) {
        if (this.selectedCells.length === 0) {
            return this.hasAdjacentCaptured(index);
        }
        return this.hasAdjacentCaptured(index) || this.isAdjacentToLastSelected(index);
    },

    isAdjacentToLastSelected(index) {
        if (this.selectedCells.length === 0) return true;
        const lastSelected = this.selectedCells[this.selectedCells.length - 1];
        const currentRow = Math.floor(index / this.gridSize);
        const currentCol = index % this.gridSize;
        const lastRow = Math.floor(lastSelected / this.gridSize);
        const lastCol = lastSelected % this.gridSize;
        return (Math.abs(currentRow - lastRow) === 1 && currentCol === lastCol) ||
            (Math.abs(currentCol - lastCol) === 1 && currentRow === lastRow);
    },

    hasAdjacentCaptured(index) {
        const row = Math.floor(index / this.gridSize);
        const col = index % this.gridSize;
        if (!this.grid.some(cell => cell.owner === this.playerRole)) {
            return this.playerRole === 'red' ? row === 0 : row === this.gridSize - 1;
        }
        const directions = [[0, -1], [0, 1], [1, 0], [-1, 0]];
        return directions.some(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
                const adjacentIndex = newRow * this.gridSize + newCol;
                return this.grid[adjacentIndex].owner === this.playerRole;
            }
            return false;
        });
    },

    resetGame() {
        sessionStorage.removeItem('roomCode'); // Changed to sessionStorage
        document.getElementById('roomInterface').style.display = 'block';
        document.getElementById('gameInterface').style.display = 'none';
        this.roomCode = null;
        this.playerRole = null;
        this.grid = [];
        this.selectedCells = [];
        this.currentExpression = [];
        this.scores = { red: 0, blue: 0 };
        this.numberUsage.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
        clearInterval(this.timer);
        this.timer = null;
        this.updateDisplay();
        this.updateHeader();
    }
};

window.onload = () => game.init();