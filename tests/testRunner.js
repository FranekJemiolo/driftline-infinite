import { CarPhysics } from '../src/carPhysics.js'
import { Road } from '../src/road.js'

class TestRunner {
  constructor() {
    this.tests = []
    this.passed = 0
    this.failed = 0
  }

  test(name, fn) {
    this.tests.push({ name, fn })
  }

  run() {
    console.log('Running tests...\n')
    
    for (const test of this.tests) {
      try {
        test.fn()
        this.passed++
        console.log(`✓ ${test.name}`)
      } catch (error) {
        this.failed++
        console.log(`✗ ${test.name}`)
        console.log(`  Error: ${error.message}`)
      }
    }

    console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`)
    return this.failed === 0
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed')
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`)
    }
  }

  assertApproxEqual(actual, expected, tolerance = 0.001, message) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(message || `Expected ${expected} ± ${tolerance}, got ${actual}`)
    }
  }
}

const runner = new TestRunner()

// ==============================
// CAR PHYSICS TESTS
// ==============================

runner.test('Car physics initializes with zero values', () => {
  const physics = new CarPhysics()
  runner.assert(physics.x === 0, 'x should be 0')
  runner.assert(physics.y === 0, 'y should be 0')
  runner.assert(physics.vx === 0, 'vx should be 0')
  runner.assert(physics.vy === 0, 'vy should be 0')
  runner.assert(physics.angle === 0, 'angle should be 0')
  runner.assert(physics.yawRate === 0, 'yawRate should be 0')
})

runner.test('Car physics reset works correctly', () => {
  const physics = new CarPhysics()
  physics.x = 100
  physics.y = 200
  physics.vx = 10
  physics.vy = 20
  physics.angle = 1.5
  physics.yawRate = 0.5
  
  physics.reset()
  
  runner.assert(physics.x === 0, 'x should be 0 after reset')
  runner.assert(physics.y === 0, 'y should be 0 after reset')
  runner.assert(physics.vx === 0, 'vx should be 0 after reset')
  runner.assert(physics.vy === 0, 'vy should be 0 after reset')
  runner.assert(physics.angle === 0, 'angle should be 0 after reset')
  runner.assert(physics.yawRate === 0, 'yawRate should be 0 after reset')
})

runner.test('Throttle increases forward velocity', () => {
  const physics = new CarPhysics()
  const input = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0 }
  const dt = 0.016 // 60fps
  
  for (let i = 0; i < 60; i++) {
    physics.step(input, surface, dt)
  }
  
  const state = physics.step(input, surface, dt)
  runner.assert(state.speed > 0, 'Speed should be positive after throttle')
  runner.assert(state.vF > 0, 'Forward velocity should be positive after throttle')
})

runner.test('Steering changes angle when moving', () => {
  const physics = new CarPhysics()
  const input = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0 }
  const dt = 0.016

  // Accelerate first
  for (let i = 0; i < 60; i++) {
    physics.step(input, surface, dt)
  }

  const initialAngle = physics.angle

  // Now steer
  const steerInput = { steer: 1, throttle: 1, brake: 0, handbrake: 0 }
  for (let i = 0; i < 60; i++) {
    physics.step(steerInput, surface, dt)
  }

  runner.assert(physics.angle !== initialAngle, 'Angle should change when steering')
})

runner.test('Steering does not change angle when stationary', () => {
  const physics = new CarPhysics()
  const input = { steer: 1, throttle: 0, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0 }
  const dt = 0.016

  const initialAngle = physics.angle

  for (let i = 0; i < 60; i++) {
    physics.step(input, surface, dt)
  }

  runner.assert(physics.angle === initialAngle, 'Angle should not change when stationary')
})

runner.test('Position updates from velocity', () => {
  const physics = new CarPhysics()
  const input = { steer: 0, throttle: 1, brake: 0, handbrake: 0 }
  const surface = { grip: 1.0 }
  const dt = 0.016
  
  const initialX = physics.x
  const initialY = physics.y
  
  for (let i = 0; i < 60; i++) {
    physics.step(input, surface, dt)
  }
  
  runner.assert(physics.x !== initialX || physics.y !== initialY, 'Position should change from velocity')
})

// ==============================
// ROAD GENERATION TESTS
// ==============================

runner.test('Road generates segments', () => {
  const road = new Road(1337)
  road.generate(100)
  
  runner.assert(road.segments.length === 100, 'Should generate 100 segments')
})

runner.test('Road segments have required properties', () => {
  const road = new Road(1337)
  road.generate(10)
  
  const segment = road.segments[0]
  runner.assert(segment.index === 0, 'Segment should have index')
  runner.assert(typeof segment.x === 'number', 'Segment should have x')
  runner.assert(typeof segment.y === 'number', 'Segment should have y')
  runner.assert(typeof segment.angle === 'number', 'Segment should have angle')
  runner.assert(typeof segment.nx === 'number', 'Segment should have nx')
  runner.assert(typeof segment.ny === 'number', 'Segment should have ny')
  runner.assert(typeof segment.width === 'number', 'Segment should have width')
  runner.assert(typeof segment.laneCount === 'number', 'Segment should have laneCount')
  runner.assert(typeof segment.isParkingLot === 'boolean', 'Segment should have isParkingLot')
})

runner.test('Road generation is deterministic', () => {
  const road1 = new Road(1337)
  road1.generate(10)
  
  const road2 = new Road(1337)
  road2.generate(10)
  
  runner.assert(road1.segments.length === road2.segments.length, 'Same number of segments')
  
  for (let i = 0; i < road1.segments.length; i++) {
    const s1 = road1.segments[i]
    const s2 = road2.segments[i]
    runner.assertApproxEqual(s1.x, s2.x, 0.001, `Segment ${i} x should match`)
    runner.assertApproxEqual(s1.y, s2.y, 0.001, `Segment ${i} y should match`)
    runner.assertApproxEqual(s1.angle, s2.angle, 0.001, `Segment ${i} angle should match`)
  }
})

runner.test('Road generation with different seeds produces different results', () => {
  const road1 = new Road(1337)
  road1.generate(50) // Generate more segments to get beyond parking lot
  
  const road2 = new Road(9999)
  road2.generate(50)
  
  let different = false
  for (let i = 30; i < road1.segments.length; i++) { // Check beyond parking lot (first 30 segments)
    const s1 = road1.segments[i]
    const s2 = road2.segments[i]
    if (s1.x !== s2.x || s1.y !== s2.y || s1.angle !== s2.angle) {
      different = true
      break
    }
  }
  
  runner.assert(different, 'Different seeds should produce different roads beyond parking lot')
})

runner.test('Road cleanup works correctly', () => {
  const road = new Road(1337)
  road.generate(100)
  
  runner.assert(road.segments.length === 100, 'Should have 100 segments before cleanup')
  
  road.cleanupRoad(50)
  
  runner.assert(road.segments.length === 50, 'Should have 50 segments after cleanup')
  runner.assert(road.segments[0].index === 0, 'First segment should be renumbered to 0')
})

runner.test('Road closest segment works', () => {
  const road = new Road(1337)
  road.generate(10)
  
  const segment = road.closestSegment(road.segments[5].x, road.segments[5].y)
  
  runner.assert(segment !== null, 'Should find a segment')
  runner.assert(segment.index === 5, 'Should find segment at index 5')
})

runner.test('Road isOnRoad works correctly', () => {
  const road = new Road(1337)
  road.generate(10)
  
  const segment = road.segments[5]
  const onRoad = road.isOnRoad(segment.x, segment.y, segment)
  
  runner.assert(onRoad, 'Should be on road at segment center')
  
  const offRoad = road.isOnRoad(segment.x + segment.width, segment.y, segment)
  runner.assert(!offRoad, 'Should be off road outside segment width')
})

// Run tests
const success = runner.run()
process.exit(success ? 0 : 1)
