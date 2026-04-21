# Driftline Infinite

A deterministic infinite drift racing engine with RWD physics and procedural road generation.

## 🎮 Live Demo

[https://franekjemiolo.github.io/driftline-infinite/](https://franekjemiolo.github.io/driftline-infinite/)

## 🏎️ Features

- **Deterministic Road Generation**: Seeded spline-based procedural roads
- **RWD Drift Physics**: Realistic rear-wheel drive drift model with slip angle simulation
- **Unified Input System**: Keyboard, touch, and gamepad support
- **Drift Scoring**: Combo-based scoring system with drift angle and speed multipliers
- **Procedural Audio**: Engine and tire sounds generated in real-time
- **Camera Follow System**: Velocity-based lookahead with smooth interpolation
- **Visual Feedback**: Skid marks, tire smoke, and drift indicators
- **Shareable Seeds**: URL hash-based seed sharing for reproducible runs

## 🎯 Gameplay

### Controls

- **WASD / Arrow Keys**: Accelerate, brake, steer
- **Space**: Handbrake
- **Gamepad**: Left stick for steering, triggers for throttle/brake, A button for handbrake

### Objective

Drift through the infinite procedural road, building up your score through sustained drifts and combo multipliers. The higher your drift angle and speed, the more points you earn.

### Scoring

- **Drift Angle**: Higher slip angles earn more points
- **Speed**: Faster drifts multiply your score
- **Combo**: Sustained drifts build combo multipliers
- **Total Score**: Accumulated over your run

## 🏗️ Architecture

### Core Systems

The engine is built with strict separation of concerns, following a deterministic simulation model:

```
INPUT → CONTROL MIXER → ROAD SAMPLE → PHYSICS STEP → WORLD UPDATE → SCORING → CAMERA → AUDIO → RENDER → UI
```

#### RoadSystem (`src/road.js`)
Pure geometry system for procedural road generation:
- Deterministic spline generation from seed using Mulberry32 RNG
- Segment-based representation with tangent and normal vectors
- Lane system with configurable width and count
- Spatial queries for closest segment lookup
- Surface sampling API for physics integration

#### CarPhysics (`src/carPhysics.js`)
RWD drift simulation model:
- Velocity decomposition into forward and lateral components
- Slip angle calculation for drift detection
- Front/rear grip separation with surface awareness
- Handbrake-induced rear grip reduction
- Throttle-induced instability model
- Yaw torque integration for realistic steering
- Stable numeric integration with fixed timestep

#### InputSystem (`src/input.js`)
Unified input abstraction:
- Keyboard input driver with WASD/Arrow key support
- Gamepad API integration
- Touch controls (ready for implementation)
- Device-independent control object
- Input smoothing and deadzone handling
- Unified output: `{ steer, throttle, brake, handbrake }`

#### RenderSystem (`src/render.js`)
Canvas 2D rendering with camera follow:
- World-to-screen projection
- Velocity-based camera lookahead
- Smooth camera interpolation
- Turn-based rotation bias
- Road rendering with lane markings
- Car rendering with rotation
- Skid mark system
- Particle system for tire smoke
- UI overlay for speed, score, and drift angle

#### ScoringSystem (`src/scoring.js`)
Drift scoring and feedback:
- Angle-based scoring
- Speed multipliers
- Combo system with progressive multipliers
- Drift time tracking
- Score banking on drift end

#### AudioSystem (`src/audio.js`)
Procedural sound generation:
- Engine sound using oscillator (frequency modulated by speed)
- Tire squeal using white noise buffer (modulated by slip angle)
- Collision impact sounds
- Web Audio API integration
- Browser policy compliance (user interaction required)

### Game Loop (`src/game.js`)

The main game loop follows strict ordering:

1. **Input**: Get unified control state
2. **Road Query**: Find closest segment (sliding window optimized)
3. **Surface Sample**: Get grip and normal at car position
4. **Physics Step**: Update car state with RWD drift model
5. **Scoring**: Update drift score and combo
6. **Audio**: Update engine and tire sounds
7. **Camera**: Update camera position and rotation
8. **Effects**: Add skid marks and particles when drifting
9. **Render**: Clear and draw all systems

### Determinism Rules

The engine guarantees deterministic behavior:

- **Road Generation**: Same seed always produces identical road geometry
- **Physics**: Same input stream always produces identical motion
- **No Time-Dependent Randomness**: All randomness is seed-based
- **Fixed Timestep**: Physics uses consistent delta time

This enables:
- Replay systems
- Ghost cars
- Leaderboard validation
- Shareable puzzle URLs

## 🧪 Testing

### Smoke Tests

Determinism validation tests in `tests/smoke.js`:

- **Road Determinism**: Verifies same seed produces identical road
- **Physics Determinism**: Verifies same input produces identical motion
- **Physics Stability**: Ensures no NaN values or velocity explosions
- **Road-Physics Integration**: Validates system coupling

Run tests:
```bash
node tests/smoke.js
```

## 🚀 Deployment

### GitHub Actions CI/CD

Automatic deployment to GitHub Pages on push to main:

- **Build**: Runs smoke tests to validate determinism
- **Deploy**: Uploads static site to GitHub Pages

The pipeline ensures:
- Physics safety (no NaN positions, velocity bounds)
- Road safety (segment consistency, curvature limits)
- Determinism guarantees (reproducible simulation)

### Manual Deployment

1. Clone the repository
2. Open `index.html` in a browser
3. No build step required - pure static files

## 🛠️ Development

### Project Structure

```
driftline-infinite/
├── assets/
│   ├── car.png
│   └── wheel.png
├── src/
│   ├── road.js          # Road generation system
│   ├── carPhysics.js    # RWD drift physics
│   ├── input.js         # Unified input abstraction
│   ├── render.js        # Canvas rendering
│   ├── scoring.js       # Drift scoring system
│   ├── audio.js         # Procedural audio
│   └── game.js          # Main game loop
├── tests/
│   └── smoke.js         # Determinism tests
├── .github/
│   └── workflows/
│       └── deploy.yml   # CI/CD pipeline
├── index.html           # Entry point
└── README.md
```

### Adding Features

#### New Obstacles

Add to RoadSystem:
- Deterministic spawn from seed
- Segment-index binding
- Collision detection via projection

#### Ghost System

Implement replay recording:
- Record input stream per frame
- Replay with same seed and inputs
- Validate score reproducibility

#### Daily Challenge

Add CI job:
- Generate daily seed
- Update README with seed
- Players compete on same road

## 📊 Performance

- **Segment Search**: Sliding window optimization (O(40) per frame)
- **Physics Step**: Constant time O(1)
- **Rendering**: Canvas 2D with hardware acceleration
- **Skid Marks**: Capped at 500 points
- **Particles**: Auto-cleanup when life expires

## 🎨 Visual Style

- **Road**: Dark asphalt with white lane markings
- **Car**: Red BMW M2 (top-down view)
- **Background**: Dark blue (#1a1a2e)
- **UI**: White text with color-coded feedback
- **Effects**: Gray skid marks, white tire smoke

## 🔮 Future Enhancements

- **Ghost Replay System**: Record and replay runs
- **Daily Seed Challenge**: Global competition on same road
- **Multiplayer Sync**: Input + seed synchronization
- **Mobile Touch Controls**: On-screen steering wheel
- **Performance Benchmarking**: FPS baseline testing
- **Visual Regression Testing**: Snapshot road + car frames

## 📝 License

MIT License - Feel free to use for learning and development

## 🙏 Acknowledgments

- Car assets from [parkit-game](https://github.com/FranekJemiolo/parkit-game)
- Inspired by drift racing games and deterministic simulation engines

---

**Built with ❤️ for the love of drift racing**
