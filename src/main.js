import { CarPhysicsMatter } from './carPhysicsMatter.js'
import { Road } from './road.js'

export class DriftGame extends Phaser.Scene {
  constructor() {
    super('DriftGame')
  }

  init() {
    this.seed = parseInt(window.location.hash.slice(1)) || 1337
    this.roadType = 'curved'
    this.debugEnabled = false
    this.zoom = 1.0
  }

  preload() {
    this.load.image('car', 'assets/packs/car.png')
    this.load.image('wheel', 'assets/wheel.png')
  }

  create() {
    // Initialize road
    this.road = new Road(this.seed)
    this.road.generate(2000)

    // Initialize car physics
    this.carPhysics = new CarPhysicsMatter()
    this.carPhysics.reset()

    // Create car container for proper rotation
    this.carContainer = this.add.container(0, 0)

    // Create car sprite from loaded image
    const carSprite = this.add.image(0, 0, 'car')
    carSprite.setScale(0.8)
    carSprite.setOrigin(0.5, 0.5)
    carSprite.disableInteractive()

    this.carContainer.add([carSprite])
    this.carContainer.setDepth(10)

    // Create 4 wheels
    const wheelScale = 0.15 * 0.75 * 0.9 // 90% of current size
    const carWidth = 40 * 0.8
    const carHeight = 80 * 0.8

    const frontOffset = (-carHeight / 2 + (carHeight * 0.10)) * 4 * 0.75 * 1.2 * 1.1 // 4x further apart, 25% closer, 1.2x height, 1.1x spacing
    const rearOffset = (carHeight / 2 - (carHeight * 0.10)) * 4 * 0.75 * 1.2 * 1.1 // 4x further apart, 25% closer, 1.2x height, 1.1x spacing
    const sideOffset = carWidth * 3 * 0.75 // 3x the width, 25% closer

    this.wheelOffsets = {
      frontLeft: { x: -sideOffset, y: frontOffset },
      frontRight: { x: sideOffset, y: frontOffset },
      rearLeft: { x: -sideOffset, y: rearOffset },
      rearRight: { x: sideOffset, y: rearOffset }
    }

    this.wheelFrontLeft = this.add.image(0, 0, 'wheel')
    this.wheelFrontLeft.setScale(wheelScale)
    this.wheelFrontLeft.setOrigin(0.5, 0.5)
    this.wheelFrontLeft.setRotation(0) // Rotated 90 degrees
    this.wheelFrontLeft.setDepth(5)

    this.wheelFrontRight = this.add.image(0, 0, 'wheel')
    this.wheelFrontRight.setScale(wheelScale)
    this.wheelFrontRight.setOrigin(0.5, 0.5)
    this.wheelFrontRight.setRotation(0) // Rotated 90 degrees
    this.wheelFrontRight.setDepth(5)

    this.wheelRearLeft = this.add.image(0, 0, 'wheel')
    this.wheelRearLeft.setScale(wheelScale)
    this.wheelRearLeft.setOrigin(0.5, 0.5)
    this.wheelRearLeft.setRotation(0) // Rotated 90 degrees
    this.wheelRearLeft.setDepth(5)

    this.wheelRearRight = this.add.image(0, 0, 'wheel')
    this.wheelRearRight.setScale(wheelScale)
    this.wheelRearRight.setOrigin(0.5, 0.5)
    this.wheelRearRight.setRotation(0) // Rotated 90 degrees
    this.wheelRearRight.setDepth(5)

    // Create road graphics
    this.roadGraphics = this.add.graphics()
    this.roadGraphics.setDepth(1)

    // Create roadblocks graphics (higher depth to be visible on top)
    this.roadblocksGraphics = this.add.graphics()
    this.roadblocksGraphics.setDepth(10)

    // Create force vector graphics
    this.forceGraphics = this.add.graphics()
    this.forceGraphics.setDepth(20)

    // Create skid marks graphics
    this.skidMarksGraphics = this.add.graphics()
    this.skidMarksGraphics.setDepth(2)

    // Create grey circle texture for smoke particles
    const smokeGraphics = this.make.graphics({ x: 0, y: 0, add: false })
    smokeGraphics.fillStyle(0x888888, 1)
    smokeGraphics.fillCircle(16, 16, 16)
    smokeGraphics.generateTexture('smoke', 32, 32)
    smokeGraphics.destroy()

    // Create smoke particle emitter with grey cloud texture
    this.smokeParticles = this.add.particles(0, 0, 'smoke', {
      lifespan: 1000,
      speed: { min: 10, max: 30 },
      scale: { start: 0.5, end: 3.0, ease: 'Quad.easeOut' }, // Get big much faster then slowly dissipate
      alpha: { start: 0.7, end: 0, ease: 'Linear' },
      frequency: 30,
      quantity: 3 // More particles
    })
    this.smokeParticles.setDepth(4)

    // Create distance marker container
    this.distanceMarkerContainer = this.add.container()
    this.distanceMarkerContainer.setDepth(3)

    // Camera setup
    this.cameras.main.centerOn(0, 0)
    this.cameras.main.setBackgroundColor(0x228b22) // Green grass color

    // Input setup
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys('W,A,S,D,SPACE')

    // Surface properties
    this.surface = { grip: 1.0, roadblocks: this.road.roadblocks, boundaries: this.road.boundaries }

    // Debug text (fixed position, ignores camera scroll)
    this.debugText = this.add.text(20, 20, '', {
      font: '14px monospace',
      color: '#ffffff'
    })
    this.debugText.setScrollFactor(0)
    this.debugText.setDepth(100)
    this.debugText.setVisible(true)

    // Game loop
    this.lastTime = performance.now()
  }

  update(time, delta) {
    const dt = delta / 1000

    // Get input
    const input = this.getInput()

    // Update car physics
    const state = this.carPhysics.step(input, this.surface, dt)

    // Update car container position and rotation
    this.carContainer.setPosition(state.x, state.y)
    this.carContainer.rotation = state.angle

    // Update wheel positions
    const cos = Math.cos(state.angle)
    const sin = Math.sin(state.angle)

    // Calculate wheel angle based on steering input with smooth interpolation
    const maxWheelAngle = 40 * Math.PI / 180 // 40 degrees in radians
    const targetWheelAngle = input.steer * maxWheelAngle

    // Smooth interpolation for wheel movement
    if (!this.currentWheelAngle) this.currentWheelAngle = 0

    // Snap to target when steering input is released or difference is small
    const angleDifference = Math.abs(targetWheelAngle - this.currentWheelAngle)
    if (angleDifference < 0.05) {
      this.currentWheelAngle = targetWheelAngle
    } else {
      const lerpFactor = 0.2 // Smooth transition factor
      this.currentWheelAngle = this.currentWheelAngle + (targetWheelAngle - this.currentWheelAngle) * lerpFactor
    }

    // Front left wheel
    const flX = state.x + (this.wheelOffsets.frontLeft.x * cos - this.wheelOffsets.frontLeft.y * sin)
    const flY = state.y + (this.wheelOffsets.frontLeft.x * sin + this.wheelOffsets.frontLeft.y * cos)
    this.wheelFrontLeft.setPosition(flX, flY)
    this.wheelFrontLeft.rotation = state.angle + this.currentWheelAngle // Rotate with car + steering

    // Front right wheel
    const frX = state.x + (this.wheelOffsets.frontRight.x * cos - this.wheelOffsets.frontRight.y * sin)
    const frY = state.y + (this.wheelOffsets.frontRight.x * sin + this.wheelOffsets.frontRight.y * cos)
    this.wheelFrontRight.setPosition(frX, frY)
    this.wheelFrontRight.rotation = state.angle + this.currentWheelAngle // Rotate with car + steering

    // Rear left wheel
    const rlX = state.x + (this.wheelOffsets.rearLeft.x * cos - this.wheelOffsets.rearLeft.y * sin)
    const rlY = state.y + (this.wheelOffsets.rearLeft.x * sin + this.wheelOffsets.rearLeft.y * cos)
    this.wheelRearLeft.setPosition(rlX, rlY)
    this.wheelRearLeft.rotation = state.angle // Rotate with car

    // Rear right wheel
    const rrX = state.x + (this.wheelOffsets.rearRight.x * cos - this.wheelOffsets.rearRight.y * sin)
    const rrY = state.y + (this.wheelOffsets.rearRight.x * sin + this.wheelOffsets.rearRight.y * cos)
    this.wheelRearRight.setPosition(rrX, rrY)
    this.wheelRearRight.rotation = state.angle // Rotate with car

    // Update camera to follow car
    this.cameras.main.centerOn(state.x, state.y)

    // Render road (only once, not every frame)
    if (!this.roadRendered) {
      this.renderRoad()
      this.roadRendered = true
    }

    // Update debug info
    if (this.debugEnabled) {
      this.updateDebugInfo(state, input)
      this.renderForceVectors(state)
    } else {
      this.updateDebugInfo(state, input)
      this.forceGraphics.clear()
    }

    // Render skid marks only when:
    // 1. Handbrake is applied (regardless of speed)
    // 2. OR accelerating (throttle applied) at slower speeds (< 60 km/h)
    // NOT when: just turning after rotation, just going straight, or slowing down
    const speedKmh = state.speed * 3.6
    const isAcceleratingAtLowSpeed = input.throttle > 0 && speedKmh < 60
    if (input.handbrake || isAcceleratingAtLowSpeed) {
      this.renderSkidMark(state, input)
    }

    // Cleanup old road segments
    const segment = this.road.getSegmentAt(state.x, state.y)
    if (segment && segment.index > 100) {
      this.road.cleanupRoad(segment.index - 50)
    }
  }

  getInput() {
    let steer = 0
    let throttle = 0
    let brake = 0
    let handbrake = 0

    // Keyboard input
    if (this.cursors.left.isDown || this.wasd.A.isDown) steer -= 1
    if (this.cursors.right.isDown || this.wasd.D.isDown) steer += 1
    if (this.cursors.up.isDown || this.wasd.W.isDown) throttle = 1
    if (this.cursors.down.isDown || this.wasd.S.isDown) brake = 1
    if (this.wasd.SPACE.isDown) handbrake = 1

    // Gamepad input
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      const gamepad = this.input.gamepad.getPad(0)
      if (gamepad) {
        const deadzone = 0.1

        // Left stick for steering
        const stickX = gamepad.axes[0]
        if (Math.abs(stickX) > deadzone) {
          steer = stickX
        }

        // Right trigger for throttle (button 7)
        // Left trigger for brake (button 6)
        if (gamepad.buttons[7]?.pressed) throttle = gamepad.buttons[7].value
        if (gamepad.buttons[6]?.pressed) brake = gamepad.buttons[6].value

        // A button for handbrake
        if (gamepad.buttons[0]?.pressed) handbrake = 1
      }
    }

    // Apply smoothing
    steer = Phaser.Math.Clamp(steer, -1, 1)
    throttle = Phaser.Math.Clamp(throttle, 0, 1)
    brake = Phaser.Math.Clamp(brake, 0, 1)
    handbrake = Phaser.Math.Clamp(handbrake, 0, 1)

    return { steer, throttle, brake, handbrake }
  }

  renderRoad() {
    this.roadGraphics.clear()
    this.roadblocksGraphics.clear()
    this.distanceMarkerContainer.removeAll()

    if (this.road.segments.length < 2) return

    // Render roadblocks
    if (this.road.roadblocks) {
      for (const block of this.road.roadblocks) {
        this.roadblocksGraphics.fillStyle(0x555555, 1) // Different grey from road (road is 0x333333)
        this.roadblocksGraphics.fillRect(block.x - block.width / 2, block.y - block.height / 2, block.width, block.height)
      }
    }

    // Render side boundaries as grey dashed lines
    if (this.road.boundaries) {
      this.roadblocksGraphics.lineStyle(15, 0x555555, 1) // Much wider grey line

      // Group boundaries by type
      const leftBoundaries = this.road.boundaries.filter(b => b.type === 'left')
      const rightBoundaries = this.road.boundaries.filter(b => b.type === 'right')

      // Draw dashed line function
      const drawDashedLine = (boundaries) => {
        if (boundaries.length < 2) return
        const dashLength = 30
        const gapLength = 20
        let currentDash = 0

        for (let i = 0; i < boundaries.length - 1; i++) {
          const start = boundaries[i]
          const end = boundaries[i + 1]
          const dx = end.x - start.x
          const dy = end.y - start.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const steps = Math.floor(distance / (dashLength + gapLength))

          for (let j = 0; j <= steps; j++) {
            const t1 = (j * (dashLength + gapLength)) / distance
            const t2 = Math.min(1, ((j * (dashLength + gapLength)) + dashLength) / distance)

            if (t1 < 1) {
              this.roadblocksGraphics.beginPath()
              this.roadblocksGraphics.moveTo(start.x + dx * t1, start.y + dy * t1)
              this.roadblocksGraphics.lineTo(start.x + dx * t2, start.y + dy * t2)
              this.roadblocksGraphics.strokePath()
            }
          }
        }
      }

      drawDashedLine(leftBoundaries)
      drawDashedLine(rightBoundaries)
    }

    // Render lane arrows
    if (this.road.laneArrows) {
      for (const arrow of this.road.laneArrows) {
        this.roadblocksGraphics.fillStyle(0xffffff, 0.8)
        // Draw arrow pointing up (calculate positions manually)
        const cos = Math.cos(arrow.angle)
        const sin = Math.sin(arrow.angle)

        // Arrow points relative to center
        const points = [
          { x: 0, y: -20 },
          { x: -15, y: 10 },
          { x: 0, y: 5 },
          { x: 15, y: 10 }
        ]

        // Rotate and translate points
        const rotatedPoints = points.map(p => ({
          x: arrow.x + (p.x * cos - p.y * sin),
          y: arrow.y + (p.x * sin + p.y * cos)
        }))

        this.roadblocksGraphics.beginPath()
        this.roadblocksGraphics.moveTo(rotatedPoints[0].x, rotatedPoints[0].y)
        this.roadblocksGraphics.lineTo(rotatedPoints[1].x, rotatedPoints[1].y)
        this.roadblocksGraphics.lineTo(rotatedPoints[2].x, rotatedPoints[2].y)
        this.roadblocksGraphics.lineTo(rotatedPoints[3].x, rotatedPoints[3].y)
        this.roadblocksGraphics.closePath()
        this.roadblocksGraphics.fillPath()
      }
    }

    for (let i = 0; i < this.road.segments.length - 1; i++) {
      const seg = this.road.segments[i]
      const nextSeg = this.road.segments[i + 1]

      this.roadGraphics.lineStyle(seg.width, seg.isParkingLot ? 0x555555 : 0x333333, 1)
      this.roadGraphics.beginPath()
      this.roadGraphics.moveTo(seg.x, seg.y)
      this.roadGraphics.lineTo(nextSeg.x, nextSeg.y)
      this.roadGraphics.strokePath()

      // Lane markings (dashed)
      if (seg.laneCount > 1) {
        const laneWidth = seg.width / seg.laneCount
        for (let j = 1; j < seg.laneCount; j++) {
          const offset = (j - seg.laneCount / 2) * laneWidth
          const laneX1 = seg.x + offset * seg.nx
          const laneY1 = seg.y + offset * seg.ny
          const laneX2 = nextSeg.x + offset * nextSeg.nx
          const laneY2 = nextSeg.y + offset * nextSeg.ny

          // Draw dashed pattern
          const dashLength = 20
          const gapLength = 20
          const totalLength = Math.hypot(laneX2 - laneX1, laneY2 - laneY1)
          const dashCount = Math.floor(totalLength / (dashLength + gapLength))
          for (let k = 0; k < dashCount; k++) {
            const t1 = k * (dashLength + gapLength) / totalLength
            const t2 = (k * (dashLength + gapLength) + dashLength) / totalLength
            const dashX1 = laneX1 + (laneX2 - laneX1) * t1
            const dashY1 = laneY1 + (laneY2 - laneY1) * t1
            const dashX2 = laneX1 + (laneX2 - laneX1) * t2
            const dashY2 = laneY1 + (laneY2 - laneY1) * t2
            this.roadGraphics.lineStyle(3, seg.isParkingLot ? 0x777777 : 0xffffff, 1)
            this.roadGraphics.beginPath()
            this.roadGraphics.moveTo(dashX1, dashY1)
            this.roadGraphics.lineTo(dashX2, dashY2)
            this.roadGraphics.strokePath()
          }
        }
      }

      // Road edges
      const halfWidth = seg.width / 2
      const edgeOffset = halfWidth - 5

      const leftX1 = seg.x - edgeOffset * seg.nx
      const leftY1 = seg.y - edgeOffset * seg.ny
      const leftX2 = nextSeg.x - edgeOffset * nextSeg.nx
      const leftY2 = nextSeg.y - edgeOffset * nextSeg.ny

      this.roadGraphics.lineStyle(4, 0xffffff, 1)
      this.roadGraphics.beginPath()
      this.roadGraphics.moveTo(leftX1, leftY1)
      this.roadGraphics.lineTo(leftX2, leftY2)
      this.roadGraphics.strokePath()

      const rightX1 = seg.x + edgeOffset * seg.nx
      const rightY1 = seg.y + edgeOffset * seg.ny
      const rightX2 = nextSeg.x + edgeOffset * nextSeg.nx
      const rightY2 = nextSeg.y + edgeOffset * nextSeg.ny

      this.roadGraphics.lineStyle(4, 0xffffff, 1)
      this.roadGraphics.beginPath()
      this.roadGraphics.moveTo(rightX1, rightY1)
      this.roadGraphics.lineTo(rightX2, rightY2)
      this.roadGraphics.strokePath()

      // Orange distance markers every 1000 meters (only within camera view)
      const segmentLength = this.road.segmentLength
      const metersPerSegment = segmentLength
      const markerInterval = 1000 // meters (10x less frequent)
      const segmentsPerMarker = markerInterval / metersPerSegment

      // Only render markers within 5000 units of camera
      const cameraX = this.cameras.main.scrollX
      const cameraY = this.cameras.main.scrollY
      const viewDistance = 5000

      if (seg.index % Math.floor(segmentsPerMarker) === 0) {
        const distToCamera = Math.hypot(seg.x - cameraX, seg.y - cameraY)
        if (distToCamera < viewDistance) {
          const markerSize = 10
          const markerOffset = halfWidth + 10
          const distance = Math.floor(seg.index * metersPerSegment)

          // Left side marker
          const markerLeftX = seg.x - markerOffset * seg.nx
          const markerLeftY = seg.y - markerOffset * seg.ny
          this.roadGraphics.fillStyle(0xff6600)
          this.roadGraphics.fillRect(markerLeftX - markerSize/2, markerLeftY - markerSize/2, markerSize, markerSize)

          // Left side distance text
          const textOffset = 20
          const textLeftX = seg.x - (markerOffset + textOffset) * seg.nx
          const textLeftY = seg.y - (markerOffset + textOffset) * seg.ny
          const distanceText = this.make.text(textLeftX, textLeftY, `${distance}m`, {
            font: '12px monospace',
            color: '#ffffff'
          })
          distanceText.setOrigin(0.5)
          distanceText.setAngle(Math.atan2(-seg.ny, seg.nx) * 180 / Math.PI)
          this.distanceMarkerContainer.add(distanceText)

          // Right side marker
          const markerRightX = seg.x + markerOffset * seg.nx
          const markerRightY = seg.y + markerOffset * seg.ny
          this.roadGraphics.fillRect(markerRightX - markerSize/2, markerRightY - markerSize/2, markerSize, markerSize)

          // Right side distance text
          const textRightX = seg.x + (markerOffset + textOffset) * seg.nx
          const textRightY = seg.y + (markerOffset + textOffset) * seg.ny
          const distanceTextRight = this.make.text(textRightX, textRightY, `${distance}m`, {
            font: '12px monospace',
            color: '#ffffff'
          })
          distanceTextRight.setOrigin(0.5)
          distanceTextRight.setAngle(Math.atan2(seg.ny, seg.nx) * 180 / Math.PI)
          this.distanceMarkerContainer.add(distanceTextRight)
        }
      }
    }
  }

  updateDebugInfo(state, input) {
    const debugInfo = [
      `Position: (${state.x.toFixed(1)}, ${state.y.toFixed(1)})`,
      `Velocity: (${state.vx.toFixed(1)}, ${state.vy.toFixed(1)})`,
      `Speed: ${(state.speed * 3.6).toFixed(1)} km/h`,
      `Angle: ${(state.angle * 180 / Math.PI).toFixed(1)}°`,
      `Slip: ${state.slip.toFixed(3)}`,
      `Drifting: ${state.drifting ? 'YES' : 'NO'}`,
      '',
      `Input:`,
      `  Throttle: ${input.throttle.toFixed(2)}`,
      `  Brake: ${input.brake.toFixed(2)}`,
      `  Handbrake: ${input.handbrake.toFixed(2)}`,
      `  Steer: ${input.steer.toFixed(2)}`,
      '',
      `Road Segments: ${this.road.segments.length}`,
      `Zoom: ${this.zoom.toFixed(2)}x`
    ].join('\n')

    this.debugText.setText(debugInfo)
  }

  renderForceVectors(state) {
    this.forceGraphics.clear()

    const scale = 20

    const forwardEndX = state.x + state.forwardX * state.vF * scale
    const forwardEndY = state.y - state.forwardY * state.vF * scale

    this.forceGraphics.lineStyle(3, 0x00ff00, 1)
    this.forceGraphics.beginPath()
    this.forceGraphics.moveTo(state.x, state.y)
    this.forceGraphics.lineTo(forwardEndX, forwardEndY)
    this.forceGraphics.strokePath()

    const lateralEndX = state.x + state.rightX * state.vL * scale
    const lateralEndY = state.y + state.rightY * state.vL * scale

    this.forceGraphics.lineStyle(3, 0xff0000, 1)
    this.forceGraphics.beginPath()
    this.forceGraphics.moveTo(state.x, state.y)
    this.forceGraphics.lineTo(lateralEndX, lateralEndY)
    this.forceGraphics.strokePath()

    const velocityEndX = state.x + state.vx * scale
    const velocityEndY = state.y - state.vy * scale

    this.forceGraphics.lineStyle(3, 0xffff00, 1)
    this.forceGraphics.beginPath()
    this.forceGraphics.moveTo(state.x, state.y)
    this.forceGraphics.lineTo(velocityEndX, velocityEndY)
    this.forceGraphics.strokePath()
  }

  renderSkidMark(state, input) {
    // Do not emit smoke if car is still or very slow
    if (state.speed < 2.78) return // 10km/h threshold

    const cos = Math.cos(state.angle)
    const sin = Math.sin(state.angle)

    const rlX = state.x + (this.wheelOffsets.rearLeft.x * cos - this.wheelOffsets.rearLeft.y * sin)
    const rlY = state.y + (this.wheelOffsets.rearLeft.x * sin + this.wheelOffsets.rearLeft.y * cos)

    const rrX = state.x + (this.wheelOffsets.rearRight.x * cos - this.wheelOffsets.rearRight.y * sin)
    const rrY = state.y + (this.wheelOffsets.rearRight.x * sin + this.wheelOffsets.rearRight.y * cos)

    this.skidMarksGraphics.lineStyle(30, 0x222222, 0.8)
    this.skidMarksGraphics.beginPath()
    this.skidMarksGraphics.moveTo(rlX, rlY)
    this.skidMarksGraphics.lineTo(rlX - state.vx * 2, rlY - state.vy * 2)
    this.skidMarksGraphics.strokePath()

    this.skidMarksGraphics.beginPath()
    this.skidMarksGraphics.moveTo(rrX, rrY)
    this.skidMarksGraphics.lineTo(rrX - state.vx * 2, rrY - state.vy * 2)
    this.skidMarksGraphics.strokePath()

    // Emit smoke particles at the sides of the tyres with random direction and size
    const smokeOffset = 20 // Offset to sides of tyres
    const smokeLeftX = rlX + smokeOffset * sin
    const smokeLeftY = rlY - smokeOffset * cos
    const smokeRightX = rrX - smokeOffset * sin
    const smokeRightY = rrY + smokeOffset * cos

    // Emit particles with random direction and size
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 10 + Math.random() * 30
      const velX = Math.cos(angle) * speed
      const velY = Math.sin(angle) * speed
      const scale = 0.5 + Math.random() * 1.5 // Random scale between 0.5 and 2.0
      const particle = this.smokeParticles.emitParticleAt(smokeLeftX, smokeLeftY, velX, velY)
      if (particle) particle.scale = scale
      const particle2 = this.smokeParticles.emitParticleAt(smokeRightX, smokeRightY, velX, velY)
      if (particle2) particle2.scale = scale
    }

    // If handbrake is activated, emit smoke from front tyres too
    if (input.handbrake) {
      const flX = state.x + (this.wheelOffsets.frontLeft.x * cos - this.wheelOffsets.frontLeft.y * sin)
      const flY = state.y + (this.wheelOffsets.frontLeft.x * sin + this.wheelOffsets.frontLeft.y * cos)

      const frX = state.x + (this.wheelOffsets.frontRight.x * cos - this.wheelOffsets.frontRight.y * sin)
      const frY = state.y + (this.wheelOffsets.frontRight.x * sin + this.wheelOffsets.frontRight.y * cos)

      const frontSmokeLeftX = flX + smokeOffset * sin
      const frontSmokeLeftY = flY - smokeOffset * cos
      const frontSmokeRightX = frX - smokeOffset * sin
      const frontSmokeRightY = frY + smokeOffset * cos

      // Emit more particles from front wheels when handbrake is activated with random direction and size
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 10 + Math.random() * 30
        const velX = Math.cos(angle) * speed
        const velY = Math.sin(angle) * speed
        const scale = 0.5 + Math.random() * 1.5 // Random scale between 0.5 and 2.0
        const particle = this.smokeParticles.emitParticleAt(frontSmokeLeftX, frontSmokeLeftY, velX, velY)
        if (particle) particle.scale = scale
        const particle2 = this.smokeParticles.emitParticleAt(frontSmokeRightX, frontSmokeRightY, velX, velY)
        if (particle2) particle2.scale = scale
      }
    }
  }

  setSeed(newSeed) {
    this.seed = newSeed
    this.road = new Road(this.seed)
    this.road.generate(2000)
    this.carPhysics.reset()
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled
    this.debugText.setVisible(this.debugEnabled)
  }
}
