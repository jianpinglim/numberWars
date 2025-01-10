
const game = {
    gridSize: 9,
    currentPlayer: 'blue',
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
    scores: { red: 0, blue: 0 },

    init() {
        this.createGrid();
        this.setupEventListeners();
        this.startTimer();
        this.updateDisplay();
        this.switchPlayer();
    },

    updateDisplay() {
        // Update all UI elements
        this.updateScores();
        this.updateNumberButtons();
        this.updateEquationDisplay();
        document.getElementById('currentPlayer').textContent = 
            this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        document.getElementById('timeLeft').textContent = this.timeLeft;
    },

    createGrid() {
        const gridElement = document.getElementById('gameGrid');
        gridElement.innerHTML = '';
        for (let i = 0; i < this.gridSize * this.gridSize; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const randomNum = Math.floor(Math.random() * 10);
            cell.textContent = randomNum;
            this.grid[i] = randomNum;
            cell.dataset.index = i;
            gridElement.appendChild(cell);
        }
    },

    setupEventListeners() {
        document.getElementById('gameGrid').addEventListener('click', (e) => {
            if (e.target.classList.contains('cell')) {
                this.handleCellClick(parseInt(e.target.dataset.index));
            }
        });

        document.querySelectorAll('[data-number]').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.number);
                if (this.canUseNumber(num)) {
                    this.currentExpression.push(num.toString());
                    this.numberUsage.current[num]++;
                    console.log(this.numberUsage)
                    this.updateEquationDisplay();
                    this.updateNumberButtons();
                }
            });
        });

        document.querySelectorAll('.operators button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentExpression.push(btn.textContent);
                this.updateEquationDisplay();
            });
        });

        document.getElementById('submit').addEventListener('click', () => this.validateAndSubmit());
        document.getElementById('clear').addEventListener('click', () => this.resetTurn());
    },

    handleCellClick(index) {
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell.classList.contains('red') || cell.classList.contains('blue')) return;
        
        if (this.isValidSelection(index)) {
            if (cell.classList.contains('selected')) {
                // Find index in selectedCells array
                const position = this.selectedCells.indexOf(index);
                // Remove this cell and all cells selected after it
                const removedCells = this.selectedCells.splice(position);
                // Remove 'selected' class from all removed cells
                removedCells.forEach(cellIndex => {
                    document.querySelector(`[data-index="${cellIndex}"]`)
                        .classList.remove('selected');
                });
            } else {
                // Only allow selection if it's adjacent to the last selected cell
                if (this.selectedCells.length === 0 || this.isAdjacentToLastSelected(index)) {
                    cell.classList.add('selected');
                    this.selectedCells.push(index);
                }
            }
        }
        document.querySelector("#currentSelection").innerHTML = this.selectedCells.map(index => this.grid[index]).join("");
    },
    
    isAdjacentToLastSelected(index) {
        if (this.selectedCells.length === 0) return true;
        
        const lastSelected = this.selectedCells[this.selectedCells.length - 1];
        const currentRow = Math.floor(index / this.gridSize);
        const currentCol = index % this.gridSize;
        const lastRow = Math.floor(lastSelected / this.gridSize);
        const lastCol = lastSelected % this.gridSize;
        
        // Check if cells are adjacent (horizontally or vertically)
        return (Math.abs(currentRow - lastRow) === 1 && currentCol === lastCol) ||
               (Math.abs(currentCol - lastCol) === 1 && currentRow === lastRow);
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
    
        const directions = [
            [0, -1], // Left
            [0, 1],  // Right
            // ...(this.currentPlayer === 'red' ? [[-1, 0]] : [[1, 0]]) // Down for red, Up for blue
            [1, 0],
            [-1, 0]
        ];
    
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
        
        // First move - allow entire top/bottom row
        if (!document.querySelector(`.${this.currentPlayer}`)) {
            if (this.currentPlayer === 'red') {
                return row === 0; // Allow any cell in top row
            } else {
                return row === this.gridSize - 1; // Allow any cell in bottom row
            }
        }
    
        // For red player - can only expand downward
        // if (this.currentPlayer === 'red') {
        //     const directions = [[-1, 0], [0,-1], [0,1]]; // Down, Left, Right
        //     return directions.some(([dr, dc]) => {
        //         const newRow = row + dr;
        //         const newCol = col + dc;
        //         if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
        //             const cell = document.querySelector(`[data-index="${newRow * this.gridSize + newCol}"]`);
        //             return cell?.classList.contains(this.currentPlayer);
        //         }
        //         return false;
        //     });
        // }
        
        // // For blue player - can only expand upward
        // if (this.currentPlayer === 'blue') {
        //     const directions = [[1,0], [0,-1], [0,1]]; // Up, Left, Right
        //     return directions.some(([dr, dc]) => {
        //         const newRow = row + dr;
        //         const newCol = col + dc;
        //         if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
        //             const cell = document.querySelector(`[data-index="${newRow * this.gridSize + newCol}"]`);
        //             return cell?.classList.contains(this.currentPlayer);
        //         }
        //         return false;
        //     });
        // }

        const directions = [
            [0, -1], // Left
            [0, 1],  // Right
            // ...(this.currentPlayer === 'red' ? [[-1, 0]] : [[1, 0]]) // Down for red, Up for blue
            [1, 0],
            [-1, 0]
        ];

        return directions.some(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.gridSize && newCol >= 0 && newCol < this.gridSize) {
                const cell = document.querySelector(`[data-index="${newRow * this.gridSize + newCol}"]`);
                return cell?.classList.contains(this.currentPlayer);
            }
            return false;
        });
    },

    canUseNumber(num) {
        return this.numberUsage["saved"][this.currentPlayer][num] - this.numberUsage["current"][num] > 0;
    },

    updateEquationDisplay() {
        document.getElementById('currentEquation').textContent = 
            this.currentExpression.join(' ');
    },

    updateNumberButtons() {
        document.querySelectorAll('[data-number]').forEach(btn => {
            const num = parseInt(btn.dataset.number);
            btn.querySelector('span').textContent = this.numberUsage.saved[this.currentPlayer][num] - this.numberUsage.current[num];
            btn.disabled = this.numberUsage.saved[this.currentPlayer][num] - this.numberUsage.current[num] === 0;
        });
    },

    validateAndSubmit() {
        if (!this.validateEquation()) {
            alert('Invalid equation!');
            return;
        }
        console.log(this.numberUsage.saved[this.currentPlayer])
        Object.entries(this.numberUsage.saved[this.currentPlayer]).forEach((e, i) => {
            this.numberUsage.saved[this.currentPlayer][i] -= this.numberUsage.current[i]
        })
        this.captureSelectedCells();
        this.switchPlayer();
        this.resetTurn();
    },

    validateEquation() {
        if (this.currentExpression.length < 3 || this.selectedCells.length < 2) {
            console.log('Invalid input:', {
                expression: this.currentExpression,
                selectedCells: this.selectedCells
            });
            return false;
        }
    
        const operatorMap = {
            '×': '*',
            '÷': '/',
            '+': '+',
            '-': '-'
        };
    
        let jsExpression = this.currentExpression
            .map(token => operatorMap[token] || token)
            .join(' ');
    
        try {
            const result = eval(jsExpression);
            const selectedValues = this.selectedCells.map(index => this.grid[index]);
            const targetNumber = Number(selectedValues.join(''));
    
            console.log({
                expression: jsExpression,
                calculatedResult: result,
                selectedCells: this.selectedCells,
                cellValues: selectedValues,
                targetNumber: targetNumber,
                isValid: result === targetNumber
            });
    
            return result === targetNumber;
        } catch (e) {
            console.error('Equation evaluation error:', e);
            return false;
        }
    },

    captureSelectedCells() {
        this.selectedCells.forEach(index => {
            const cell = document.querySelector(`[data-index="${index}"]`);
            cell.classList.remove('selected');
            cell.classList.add(this.currentPlayer);
        });
        this.scores[this.currentPlayer] += this.selectedCells.length;
        this.updateScores();
        this.checkWinCondition();
    },

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'red' ? 'blue' : 'red';
        document.getElementById('currentPlayer').textContent = 
            this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        this.resetTurn()
        this.resetTimer();
        Object.entries(this.numberUsage.saved[this.currentPlayer]).forEach((e, i) => {
            this.numberUsage.saved[this.currentPlayer][i]++
            if (this.numberUsage.saved[this.currentPlayer][i] > 6) {
                this.numberUsage.saved[this.currentPlayer][i] = 6;
            }
        })
        console.log(this.numberUsage.saved)
        document.querySelector("body").style.backgroundColor = this.currentPlayer == 'red' ? "rgb(224, 101, 101)" : "rgb(101, 140, 224)"
    },

    startTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            document.getElementById('timeLeft').textContent = this.timeLeft;
            if (this.timeLeft <= 0) {
                this.switchPlayer();
            }
        }, 1000);
    },

    resetTimer() {
        clearInterval(this.timer);  // Clear existing timer
        this.timeLeft = 120;
        document.getElementById('timeLeft').textContent = this.timeLeft;
        this.startTimer();  // Start new timer
    },
    

    updateScores() {
        document.getElementById('redScore').textContent = this.scores.red;
        document.getElementById('blueScore').textContent = this.scores.blue;
    },

    resetTurn() {
        this.currentExpression = [];
        this.updateEquationDisplay();
        this.clearSelection();
        this.resetNumberUsage();
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
        } // reset selection
    },

    checkWinCondition() {
        const totalCells = this.gridSize * this.gridSize;
        const capturedCells = document.querySelectorAll('.red, .blue').length;
        
        if (capturedCells === totalCells) {
            const redScore = document.querySelectorAll('.red').length;
            const blueScore = document.querySelectorAll('.blue').length;
            const winner = redScore > blueScore ? 'Red' : 'Blue';
            alert(`Game Over! ${winner} wins!`);
            clearInterval(this.timer);
            return true;
        }
        return false;
    }
};

window.onload = () => game.init();

