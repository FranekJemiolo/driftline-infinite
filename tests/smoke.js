// ==============================
// SMOKE TESTS FOR DETERMINISM VALIDATION
// ==============================

// Mock the systems for Node.js testing
class RoadSystem {
  constructor(seed = 1) {
    this.seed = seed
    this.segments = []
    this.width = 140
    this.laneCount = 3
    this.segmentLength = 8
    this._rng = this.mulberry32(seed)
  }

  mulberry32(a) {
    return function () {
      let t = a += 0x6D2B79F5
      t = Math.imul(t ^ t >>> 15, t | 1)
      t ^= t + Math.imul(t ^ t >>> 7, t | 61)
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  generate(count = 2000) {
    let x = 0, y = 0, angle = 0

    for (let i = 0; i < count; i++) {
      const noise =
        Math.sin(i * 0.02) * 0.7 +
        Math.sin(i * 0.007) * 0.3 +
        (this._rng() - 0.5) * 0.2

      angle += noise * 0.03

      x += Math.sin(angle) * this.segmentLength
      y += Math.cos(angle) * this.segmentLength

      const nx = Math.cos(angle)
      const ny = -Math.sin(angle)

      this.segments.push({
        index: i,
        x,
        y,
        nx,
        ny,
        angle,
        width: this.width,
        laneCount: this.laneCount
      })
    }
  }

  closestSegment(px, py, start = 0, range = 40) {
    let best = null
    let bestD = Infinity
    const end = Math.min(this.segments.length, start + range)

    for (let i = start; i < end; i++) {
      const s = this.segments[i]
      const dx = px - s.x
      const dy = py - s.y
      const d = dx * dx + dy * dy

      if (d < bestD) {
        bestD = d
        best = s
      }
    }

    return best
  }

  sampleSurface(px, py, segment) {
    if (!segment) return { grip: 1.0, normalX: 0, normalY: 1, onRoad: false }

    const dx = px - segment.x
    const dy = py - segment.y
    const lateralOffset = dx * segment.nx + dy * segment.ny

    const halfWidth = segment.width / 2
    const onRoad = Math.abs(lateralOffset) <= halfWidth

    const grip = onRoad ? 1.0 : 0.3

    return {
      grip,
      normalX: segment.nx,
      normalY: segment.ny,
      onRoad,
      lateralOffset
    }
  }

  isOnRoad(px, py, segment) {
    if (!segment) return false

    const dx = px - segment.x
    const dy = py - segment.y
    const lateralOffset = dx * segment.nx + dy * segment.ny

    return Math.abs(lateralOffset) <= segment.width / 2
  }
}

class CarPhysics {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = 0
    this.y = 0
    this.vx = 0
    this.vy = 0
    this.angle = 0
    this.yawRate = 0
    this.mass = 1.0
    this.gripFront = 1.2
    this.gripRear = 1.0
    this.drift = 0
  }

  step(input, surface, dt) {
    const forwardX = Math.sin(this.angle)
    const forwardY = Math.cos(this.angle)
    const rightX = Math.cos(this.angle)
    const rightY = -Math.sin(this.angle)

    const vF = this.vx * forwardX + this.vy * forwardY
    const vL = this.vx * rightX + this.vy * rightY
    const slip = Math.atan2(Math.abs(vL), Math.max(1, Math.abs(vF)))

    const rearGrip = this.gripRear * surface.grip
    const frontGrip = this.gripFront * surface.grip
    const rearGripMod = input.handbrake ? rearGrip * 0.2 : rearGrip
    const throttleSlipBoost = input.throttle * 0.5

    const steer = input.steer * 0.6
    const yawForce = (steer * frontGrip) - (vL * rearGripMod * 0.002) + throttleSlipBoost

    this.yawRate += yawForce * dt
    this.angle += this.yawRate * dt

    const engine = input.throttle * 900
    const brake = input.brake * 600
    let newVF = vF + (engine - brake) * dt
    let newVL = vL * (1 - frontGrip * 0.02)

    this.vx = forwardX * newVF + rightX * newVL
    this.vy = forwardY * newVF + rightY * newVL

    this.x += this.vx * dt
    this.y += this.vy * dt
    this.drift = slip

    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      angle: this.angle,
      yawRate: this.yawRate,
      slip,
      speed: Math.hypot(this.vx, this.vy),
      drifting: slip > 0.35
    }
  }
}

// Test 1: Road determinism
function testRoadDeterminism() {
  console.log('Testing road determinism...')
  
  const road1 = new RoadSystem(1337)
  road1.generate(100)

  const road2 = new RoadSystem(1337)
  road2.generate(100)

  if (road1.segments.length !== road2.segments.length) {
    throw new Error('Road segment count mismatch')
  }

  for (let i = 0; i < road1.segments.length; i++) {
    const s1 = road1.segments[i]
    const s2 = road2.segments[i]

    if (Math.abs(s1.x - s2.x) > 0.001 || Math.abs(s1.y - s2.y) > 0.001) {
      throw new Error(`Road segment ${i} position mismatch`)
    }

    if (Math.abs(s1.angle - s2.angle) > 0.001) {
      throw new Error(`Road segment ${i} angle mismatch`)
    }
  }

  console.log('✓ Road determinism test passed')
}

// Test 2: Physics determinism
function testPhysicsDeterminism() {
  console.log('Testing physics determinism...')

  const car1 = new CarPhysics()
  const car2 = new CarPhysics()

  const input = { steer: 0.5, throttle: 0.8, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0, normalX: 0, normalY: 1 }
  const dt = 0.016

  for (let i = 0; i < 100; i++) {
    car1.step(input, surface, dt)
    car2.step(input, surface, dt)

    if (Math.abs(car1.x - car2.x) > 0.001 || Math.abs(car1.y - car2.y) > 0.001) {
      throw new Error(`Physics position mismatch at step ${i}`)
    }

    if (Math.abs(car1.angle - car2.angle) > 0.001) {
      throw new Error(`Physics angle mismatch at step ${i}`)
    }
  }

  console.log('✓ Physics determinism test passed')
}

// Test 3: Physics stability (no NaN or explosion)
function testPhysicsStability() {
  console.log('Testing physics stability...')

  const car = new CarPhysics()
  const input = { steer: 0.5, throttle: 1.0, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0, normalX: 0, normalY: 1 }
  const dt = 0.016

  for (let i = 0; i < 1000; i++) {
    const state = car.step(input, surface, dt)

    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
      throw new Error(`Physics NaN detected at step ${i}`)
    }

    if (!Number.isFinite(state.vx) || !Number.isFinite(state.vy)) {
      throw new Error(`Physics velocity NaN at step ${i}`)
    }

    if (Math.abs(state.vx) > 10000 || Math.abs(state.vy) > 10000) {
      throw new Error(`Physics velocity explosion at step ${i}`)
    }
  }

  console.log('✓ Physics stability test passed')
}

// Test 4: Road-Physics integration
function testRoadPhysicsIntegration() {
  console.log('Testing road-physics integration...')

  const road = new RoadSystem(1337)
  road.generate(200)

  const car1 = new CarPhysics()
  const car2 = new CarPhysics()

  const input = { steer: 0.3, throttle: 0.6, brake: 0, handbrake: 0 }
  const dt = 0.016

  for (let i = 0; i < 200; i++) {
    const segment1 = road.closestSegment(car1.x, car1.y, 0, 40)
    const surface1 = road.sampleSurface(car1.x, car1.y, segment1)
    car1.step(input, surface1, dt)

    const segment2 = road.closestSegment(car2.x, car2.y, 0, 40)
    const surface2 = road.sampleSurface(car2.x, car2.y, segment2)
    car2.step(input, surface2, dt)

    if (Math.abs(car1.x - car2.x) > 0.001 || Math.abs(car1.y - car2.y) > 0.001) {
      throw new Error(`Integration position mismatch at step ${i}`)
    }
  }

  console.log('✓ Road-physics integration test passed')
}

// Test 5: Road bounds detection
function testRoadBoundsDetection() {
  console.log('Testing road bounds detection...')

  const road = new RoadSystem(1337)
  road.generate(100)

  const segment = road.segments[50]

  // Test on-road position
  const onRoad = road.isOnRoad(segment.x, segment.y, segment)
  if (!onRoad) {
    throw new Error('Center of road should be on-road')
  }

  // Test off-road position (beyond width)
  const offRoad = road.isOnRoad(segment.x + segment.width, segment.y, segment)
  if (offRoad) {
    throw new Error('Position beyond road width should be off-road')
  }

  // Test surface grip reduction
  const surfaceOnRoad = road.sampleSurface(segment.x, segment.y, segment)
  if (surfaceOnRoad.grip !== 1.0) {
    throw new Error('On-road grip should be 1.0')
  }

  const surfaceOffRoad = road.sampleSurface(segment.x + segment.width, segment.y, segment)
  if (surfaceOffRoad.grip !== 0.3) {
    throw new Error('Off-road grip should be 0.3')
  }

  console.log('✓ Road bounds detection test passed')
}

// Run all tests
try {
  testRoadDeterminism()
  testPhysicsDeterminism()
  testPhysicsStability()
  testRoadPhysicsIntegration()
  testRoadBoundsDetection()
  
  console.log('\n✅ All smoke tests passed!')
  process.exit(0)
} catch (error) {
  console.error('\n❌ Smoke test failed:', error.message)
  process.exit(1)
}
