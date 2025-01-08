# README.md

# Number Wars

## Overview
Number Wars is a turn-based web game for two players, where players compete to capture a 9x9 grid filled with random numbers. Players must form valid mathematical equations using numbers from 1 to 6 to capture grid cells.

## Game Rules
- The game is played on a 9x9 grid with random numbers from 0-9.
- Players take turns to form equations using numbers from 1-6, no more than twice.
- Player Red starts from the top left, and Player Blue starts from the bottom right.
- Players can only capture cells starting from their respective grid positions.
- Valid operations include addition (+), subtraction (-), multiplication (*), and division (/).
- The game tracks number usage and enforces the twice-only rule.
- The game automatically identifies the row or column the player is answering from.
- Players have 2 minutes per turn.

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Open the `index.html` file in your web browser to start playing.

## File Structure
```
number-wars
├── src
│   ├── index.html        # Main HTML structure
│   ├── styles
│   │   └── main.css      # Styles for the web app
│   ├── scripts
│   │   ├── game.js       # Game logic
│   │   ├── grid.js       # Grid management
│   │   ├── player.js     # Player class
│   │   ├── validator.js   # Equation validation
│   │   └── timer.js      # Turn timer management
├── README.md             # Project documentation
└── .gitignore            # Files to ignore in version control
```

## How to Play
- Select cells on the grid to form an equation.
- Use the numbers from 1-6 to create valid equations.
- Capture cells by forming correct equations based on the selected cells.
- Keep track of your score and the number of cells captured.

Enjoy playing Number Wars!