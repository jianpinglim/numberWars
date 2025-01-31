import { supabase } from './supabaseClient.js';

const baseGame = {
    gridSize: 9,
    currentPlayer: 'red',
    selectedCells: [],
    grid: [],
    timeLeft: 120,
    timer: null,
    currentExpression: [],
    numberUsage: {
        saved: {
            red: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 },
            blue: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 }
        },
        current: {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        }
    },
    scores: { red: 0, blue: 0 }
};

const multiplayer = {
    ...baseGame,
    roomId: null,
    playerColor: null,
    channel: null,

    numberUsage: {
        saved: {
            red: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 },
            blue: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 6, 8: 6, 9: 6 }
        },
        current: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
    },

    handleError(error) {
        console.error('Game error:', error);
        alert('An error occurred. Please refresh and try again.');
    },

    async init() {
        try {
            this.channel = supabase
                .channel('game_rooms')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'game_rooms',
                        filter: `id=eq.${this.roomId}`
                    },
                    (payload) => {
                        console.log('Realtime payload:', payload);
                        if (payload.new?.id === this.roomId) {
                            this.updateFromGameState(payload.new.state);
                        }
                    }
                );
    
            await this.channel.subscribe();
            console.log('Channel status:', this.channel.state);
    
            this.setupUI();
            document.querySelector('.container').classList.add('hidden');
        } catch (error) {
            console.error('Connection error:', error);
            alert('Failed to connect. Please try again.');
        }
    },

    updateFromGameState(state) {
        if (!state) return;
        console.log('Updating from game state:', state);
    
        this.grid = state.grid;
        this.currentPlayer = state.currentPlayer;
        this.scores = state.scores;
        this.timeLeft = state.timeLeft;
        this.numberUsage = state.numberUsage;
    
        // Clear prior captures
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('captured-red', 'captured-blue', 'selected');
        });
    
        // Re-apply captured cells
        (state.capturedCells?.red || []).forEach(i => {
            document.querySelector(`[data-index="${i}"]`)?.classList.add('captured-red');
        });
        (state.capturedCells?.blue || []).forEach(i => {
            document.querySelector(`[data-index="${i}"]`)?.classList.add('captured-blue');
        });
    
        this.updateDisplay();
    },

    async saveStateToSupabase() {
        const capturedRed = Array.from(document.querySelectorAll('.captured-red'))
            .map(cell => parseInt(cell.dataset.index));
        const capturedBlue = Array.from(document.querySelectorAll('.captured-blue'))
            .map(cell => parseInt(cell.dataset.index));
    
        console.log('Saving state:', {
            grid: this.grid,
            currentPlayer: this.currentPlayer,
            scores: this.scores,
            timeLeft: this.timeLeft,
            numberUsage: this.numberUsage,
            capturedCells: { red: capturedRed, blue: capturedBlue }
        });
    
        try {
            const { error } = await supabase
                .from('game_rooms')
                .update({
                    state: {
                        grid: this.grid,
                        currentPlayer: this.currentPlayer,
                        scores: this.scores,
                        timeLeft: this.timeLeft,
                        numberUsage: this.numberUsage,
                        capturedCells: { red: capturedRed, blue: capturedBlue }
                    }
                })
                .eq('id', this.roomId);
    
            if (error) console.error('Error saving state:', error);
        } catch (err) {
            console.error('Failed to save state:', err);
        }
    },

    setupUI() {
        document.getElementById('createRoom').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('joinRoom').addEventListener('click', () => {
            const roomCode = document.getElementById('roomInput').value;
            if (roomCode) this.joinRoom(roomCode);
        });
    },

    async createRoom() {
        try {
            const { data, error } = await supabase
                .from('game_rooms')
                .insert([{
                    state: {
                        grid: Array(this.gridSize * this.gridSize)
                            .fill(0)
                            .map(() => Math.floor(Math.random() * 9) + 1),
                        currentPlayer: 'red',
                        scores: { red: 0, blue: 0 },
                        timeLeft: 120,
                        capturedCells: { red: [], blue: [] } // Initialize capturedCells
                    }
                }])
                .select()
                .single();

            if (error) throw error;

            this.roomId = data.id;
            this.playerColor = 'red';
            document.getElementById('roomCode').textContent = this.roomId;
            document.getElementById('roomInfo').classList.remove('hidden');
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room');
        }
    },

    async joinRoom(roomCode) {
        try {
            const { data, error } = await supabase
                .from('game_rooms')
                .select()
                .eq('id', roomCode)
                .single();

            if (error) throw error;

            this.roomId = roomCode;
            if (!this.playerColor)
                this.playerColor = 'blue';
            this.initializeGame(data.state);
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room');
        }
    },

    initializeGame(state) {
        try {
            this.grid = state.grid || [];
            this.currentPlayer = state.currentPlayer || 'red';
            this.scores = state.scores || { red: 0, blue: 0 };
            this.timeLeft = state.timeLeft || 120;
            this.numberUsage = state.numberUsage || this.numberUsage;

            document.querySelector('.container').classList.remove('hidden');
            document.getElementById('roomInfo').classList.add('hidden');

            this.createGrid();
            this.setupEventListeners();
            this.startTimer();
            this.updateDisplay();
        } catch (error) {
            console.error('Error initializing game:', error);
            this.handleError(error);
        }
    },

    createGrid() {
        const gridElement = document.getElementById('gameGrid');
        gridElement.innerHTML = '';
        this.grid.forEach((num, index) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = num;
            cell.dataset.index = index;
            gridElement.appendChild(cell);
        });
    },

    setupEventListeners() {
        // Clear existing event listeners
        document.querySelectorAll('.cell').forEach(cell => {
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
        });
        document.querySelectorAll('[data-number]').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
        // Clear and re-add for operators
        document.querySelectorAll('.operators button').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });
    
        // Add listeners for operators
        document.querySelectorAll('.operators button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.currentPlayer === this.playerColor) {
                    if (this.currentExpression.length > 0) {
                        this.currentExpression.push(btn.textContent);
                        this.updateEquationDisplay();
                    }
                }
            });
        });

        // Grid cell clicks for cell selection
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', () => {
                if (this.currentPlayer === this.playerColor) {
                    const index = parseInt(cell.dataset.index);
                    if (!cell.classList.contains('captured-red') && !cell.classList.contains('captured-blue')) {
                        this.handleCellClick(index);
                    }
                }
            });
        });

        // Number buttons with usage tracking
        document.querySelectorAll('[data-number]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.currentPlayer === this.playerColor) {
                    const num = parseInt(btn.dataset.number);
                    if (this.canUseNumber(num)) {
                        this.currentExpression.push(num.toString());
                        this.numberUsage.current[num]++;
                        this.updateEquationDisplay();
                        this.updateNumberButtons();
                    }
                }
            });
        });

        // Operator buttons for equation building
        document.querySelectorAll('.operator-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.currentPlayer === this.playerColor &&
                    this.currentExpression.length > 0) {
                    this.currentExpression.push(btn.dataset.operator);
                    this.updateEquationDisplay();
                }
            });
        });

        // Action buttons
        document.getElementById('submit').addEventListener('click', () => {
            if (this.currentPlayer === this.playerColor) {
                this.validateAndSubmit();
            }
        });

        document.getElementById('clear').addEventListener('click', () => {
            if (this.currentPlayer === this.playerColor) {
                this.resetTurn();
            }
        });
    },

    handleCellClick(index) {
        if (!this.isValidSelection(index)) return;

        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell.classList.contains('selected')) {
            const position = this.selectedCells.indexOf(index);
            const removedCells = this.selectedCells.splice(position);
            removedCells.forEach(cellIndex => {
                document.querySelector(`[data-index="${cellIndex}"]`)
                    .classList.remove('selected');
            });
        } else if (this.isAdjacentToLastSelected(index)) {
            cell.classList.add('selected');
            this.selectedCells.push(index);
        }

        document.querySelector("#currentSelection").innerHTML =
            this.selectedCells.map(index => this.grid[index]).join("");
    },

    startTimer() {
        this.timer = setInterval(async () => {
            this.timeLeft--;
            document.getElementById('timeLeft').textContent = this.timeLeft;
    
            // Save the updated timeLeft to Supabase
            await this.saveStateToSupabase();
    
            if (this.timeLeft <= 0) {
                this.switchPlayer();
            }
        }, 1000);
    },

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'red' ? 'blue' : 'red';
        document.getElementById('currentPlayer').textContent =
            this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        this.resetTurn();
        this.resetTimer();
        Object.entries(this.numberUsage.saved[this.currentPlayer]).forEach((e, i) => {
            this.numberUsage.saved[this.currentPlayer][i]++;
            if (this.numberUsage.saved[this.currentPlayer][i] > 6) {
                this.numberUsage.saved[this.currentPlayer][i] = 6;
            }
        });
        console.log(this.numberUsage.saved);
        document.querySelector("body").style.backgroundColor = this.currentPlayer == 'red' ? "rgb(224, 101, 101)" : "rgb(101, 140, 224)";
    },

    resetTimer() {
        clearInterval(this.timer);
        this.timeLeft = 120;
        document.getElementById('timeLeft').textContent = this.timeLeft;
        this.startTimer();
    },

    validateEquation() {
        if (this.currentExpression.length < 3 || this.selectedCells.length < 2) return false;

        const operatorMap = { '×': '*', '÷': '/', '+': '+', '-': '-' };
        let jsExpression = this.currentExpression
            .map(token => operatorMap[token] || token)
            .join(' ');

        try {
            const result = eval(jsExpression);
            const targetNumber = Number(this.selectedCells.map(index => this.grid[index]).join(''));
            return result === targetNumber;
        } catch (e) {
            console.error('Equation evaluation error:', e);
            return false;
        }
    },

    isValidSelection(index) {
        if (this.selectedCells.length === 0) {
            return this.hasAdjacentCaptured(index);
        }
        return this.hasAdjacentCaptured(index) || this.hasAdjacentSelected(index);
    },

    hasAdjacentSelected(index) {
        const row = Math.floor(index / this.gridSize);
        const col = index % this.gridSize;

        const directions = [[0, -1], [0, 1], [1, 0], [-1, 0]];

        return directions.some(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
                const adjacentIndex = newRow * this.gridSize + newCol;
                return this.selectedCells.includes(adjacentIndex);
            }
            return false;
        });
    },

    hasAdjacentCaptured(index) {
        const row = Math.floor(index / this.gridSize);
        const col = index % this.gridSize;

        if (!document.querySelector(`.${this.currentPlayer}`)) {
            if (this.currentPlayer === 'red') return row === 0;
            else return row === this.gridSize - 1;
        }

        const directions = [[0, -1], [0, 1], [1, 0], [-1, 0]];

        return directions.some(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
                const cell = document.querySelector(`[data-index="${newRow * this.gridSize + newCol}"]`);
                return cell?.classList.contains(`captured-${this.currentPlayer}`);
            }
            return false;
        });
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

    updateDisplay() {
        try {
            // Update scores
            this.updateScores();

            // Update current player
            document.getElementById('currentPlayer').textContent =
                this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);

            // Update equation
            this.updateEquationDisplay();

            // Update number buttons
            this.updateNumberButtons();
        } catch (error) {
            console.error('Error updating display:', error);
            this.handleError(error);
        }
    },

    updateScores() {
        document.getElementById('redScore').textContent = this.scores.red;
        document.getElementById('blueScore').textContent = this.scores.blue;
    },

    updateNumberButtons() {
        document.querySelectorAll('[data-number]').forEach(btn => {
            const num = parseInt(btn.dataset.number);
            const remaining = this.numberUsage.saved[this.playerColor][num] -
                this.numberUsage.current[num];
            const span = btn.querySelector('span');
            if (span) {
                span.textContent = remaining;
            }
            btn.disabled = remaining <= 0;
        });
    },

    updateEquationDisplay() {
        const equationElement = document.getElementById('currentEquation');
        if (equationElement) {
            equationElement.textContent = this.currentExpression.join(' ');
        }
    },

    validateAndSubmit() {
        if (!this.validateEquation()) {
            alert('Invalid equation!');
            return;
        }

        this.captureSelectedCells();
        this.switchPlayer();
        this.resetTurn();
        this.saveStateToSupabase(); // Sync state after move
    },

    captureSelectedCells() {
        // Apply local UI updates
        this.selectedCells.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.remove('selected');
            cell.classList.add(`captured-${this.playerColor}`);
        });

        // Increase score
        this.scores[this.playerColor] += this.selectedCells.length;
        this.selectedCells = [];

        // Save to database so other players see the update
        this.saveStateToSupabase();
    },

    canUseNumber(num) {
        const maxUses = this.numberUsage.saved[this.playerColor][num];
        const currentUses = this.numberUsage.current[num];
        return currentUses < maxUses;
    },

    resetTurn() {
        this.selectedCells = [];
        this.currentExpression = [];
        this.resetNumberUsage();
        this.updateEquationDisplay();
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('selected');
        });
        document.querySelector("#currentSelection").innerHTML = '';
    },

    resetNumberUsage() {
        this.numberUsage.current = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        };
        this.updateNumberButtons();
    },

    clearSelection() {
        this.selectedCells.forEach(index => {
            document.querySelector(`[data-index="${index}"]`).classList.remove('selected');
        });
        this.selectedCells = [];
        document.querySelector("#currentSelection").innerHTML = this.selectedCells.map(index => this.grid[index]).join("");
        this.numberUsage.current = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
        }; // Reset number usage for the current turn
        this.updateNumberButtons(); // Update the number buttons to reflect the reset usage
    },

    checkWinCondition() {
        const totalCells = this.gridSize * this.gridSize;
        const capturedCells = document.querySelectorAll('.captured-red, .captured-blue').length;

        if (capturedCells === totalCells) {
            const redScore = document.querySelectorAll('.captured-red').length;
            const blueScore = document.querySelectorAll('.captured-blue').length;
            const winner = redScore > blueScore ? 'Red' : 'Blue';
            alert(`Game Over! ${winner} wins!`);
            clearInterval(this.timer);
            return true;
        }
        return false;
    }
};

window.onload = () => multiplayer.init();
