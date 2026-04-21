// ==============================
// MAIN GAME LOOP
// ==============================

import { RoadSystem } from './road.js'
import { CarPhysics } from './carPhysics.js'
import { InputSystem } from './input.js'
import { RenderSystem } from './render.js'
import { ScoringSystem } from './scoring.js'
import { AudioSystem } from './audio.js'

export class Game {
  constructor(canvas, seed = 1337) {
    this.seed = seed
    
    // Core systems
    this.road = new RoadSystem(seed)
    this.car = new CarPhysics()
    this.input = new InputSystem()
    this.render = new RenderSystem(canvas)
    this.scoring = new ScoringSystem()
    this.audio = new AudioSystem()

    // Game state
    this.running = false
    this.lastTime = 0
    this.segmentSearchStart = 0

    // Assets
    this.carImage = null

    this._init()
  }

  async _init() {
    // Generate road
    this.road.generate(2000)

    // Load car image
    this.carImage = new Image()
    this.carImage.src = '../assets/car.png'

    // Setup canvas
    this.render.resize()
    window.addEventListener('resize', () => this.render.resize())

    // Start audio on first interaction
    window.addEventListener('click', () => this.audio.init(), { once: true })
    window.addEventListener('keydown', () => this.audio.init(), { once: true })
  }

  start() {
    this.running = true
    this.lastTime = performance.now()
    this.loop()
  }

  stop() {
    this.running = false
  }

  loop(currentTime = performance.now()) {
    if (!this.running) return

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1)
    this.lastTime = currentTime

    this.update(dt)
    this.renderFrame()

    requestAnimationFrame((t) => this.loop(t))
  }

  update(dt) {
    // Get input
    const input = this.input.update()

    // Find closest road segment (with sliding window optimization)
    const segment = this.road.closestSegment(
      this.car.x,
      this.car.y,
      this.segmentSearchStart,
      40
    )

    if (segment) {
      this.segmentSearchStart = Math.max(0, segment.index - 20)
    }

    // Sample road surface
    const surface = this.road.sampleSurface(this.car.x, this.car.y, segment)

    // Step physics
    const carState = this.car.step(input, surface, dt)

    // Update scoring
    const scoreState = this.scoring.update(carState, dt)

    // Update audio
    this.audio.update(carState)

    // Update camera
    this.render.updateCamera(this.car, this.road)

    // Add skid marks when drifting
    if (carState.drifting && carState.speed > 5) {
      this.render.addSkidMark(this.car.x, this.car.y)
      
      // Add tire smoke particles
      if (Math.random() < 0.3) {
        const spread = 10
        this.render.addParticle(
          this.car.x + (Math.random() - 0.5) * spread,
          this.car.y + (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        )
      }
    }

    return { carState, scoreState }
  }

  renderFrame() {
    this.render.clear()
    this.render.renderRoad(this.road)
    this.render.renderSkidMarks()
    this.render.renderCar(this.car, this.carImage)
    this.render.renderParticles()
    this.render.renderUI(this.car, this.scoring.score)
  }

  reset() {
    this.car.reset()
    this.scoring.reset()
    this.segmentSearchStart = 0
  }

  setSeed(seed) {
    this.seed = seed
    this.road = new RoadSystem(seed)
    this.road.generate(2000)
    this.reset()
  }
}
