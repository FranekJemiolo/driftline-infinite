// ==============================
// CAR PHYSICS (MATTER.JS INTEGRATION)
// ==============================

const { Engine, World, Bodies, Body } = Matter

export class CarPhysicsMatter {
  constructor() {
    this.engine = Engine.create()
    this.world = this.engine.world

    // Disable gravity for top-down simulation
    this.engine.world.gravity.y = 0
    this.engine.world.gravity.x = 0

    // --- CAR BODY
    this.body = Bodies.rectangle(0, 0, 20, 40, {
      friction: 0.01,
      frictionAir: 0.005, // Reduced to slow down less quickly
      restitution: 0.1
    })

    World.add(this.world, this.body)

    // tuning
    this.maxForce = 0.001
    this.brakeForce = 0.002
    this.handbrakeForce = 0.005 // Moderate handbrake force
    this.steerTorque = 0.002 // Increased for faster, less boat-like turning
    this.maxBackwardSpeed = 13.89 // 50km/h / 3.6

    this.grip = 0.9

    // Boundary collision detection - large enough to not interfere with parking lot
    this.boundary = {
      top: -2000,
      bottom: 2000,
      left: -2000,
      right: 2000
    }
  }

  checkBoundaryCollision(roadblocks, boundaries) {
    const body = this.body
    const pos = body.position
    const vel = body.velocity

    // Car dimensions for collision detection (based on actual rendered size)
    const carWidth = 144 // From wheel positions (-72 to 72)
    const carHeight = 203 // From wheel positions (-101.4 to 101.4)
    const buffer = 10 // Extra buffer to ensure car doesn't visually overlap

    const halfWidth = carWidth / 2 + buffer
    const halfHeight = carHeight / 2 + buffer

    // Check against simple boundary box (no top boundary - allow going up infinitely)
    if (pos.x - halfWidth < this.boundary.left) {
      pos.x = this.boundary.left + halfWidth
      vel.x = -vel.x * 0.5 // Bounce back with reduced speed
    }
    if (pos.x + halfWidth > this.boundary.right) {
      pos.x = this.boundary.right - halfWidth
      vel.x = -vel.x * 0.5
    }
    // No top boundary check - allow going up (negative Y) infinitely
    if (pos.y + halfHeight > this.boundary.bottom) {
      pos.y = this.boundary.bottom - halfHeight
      vel.y = -vel.y * 0.5
    }

    // Check against roadblocks
    if (roadblocks) {
      for (const block of roadblocks) {
        // Check if car is within roadblock bounds (accounting for car dimensions)
        if (pos.x + halfWidth > block.left && pos.x - halfWidth < block.right &&
            pos.y + halfHeight > block.top && pos.y - halfHeight < block.bottom) {
          // Collision detected - bounce back
          // Determine which side was hit based on previous position
          const prevPos = body.position
          const prevX = prevPos.x - vel.x * 0.016 // Approximate previous position
          const prevY = prevPos.y - vel.y * 0.016

          // Check which side was hit
          if (prevX + halfWidth > block.left && prevX + halfWidth < block.right) {
            // Hit from left or right
            if (prevX < block.left) {
              pos.x = block.left - halfWidth - 1
            } else {
              pos.x = block.right + halfWidth + 1
            }
            vel.x = -vel.x * 0.5
          }
          if (prevY + halfHeight > block.top && prevY + halfHeight < block.bottom) {
            // Hit from top or bottom
            if (prevY < block.top) {
              pos.y = block.top - halfHeight - 1
            } else {
              pos.y = block.bottom + halfHeight + 1
            }
            vel.y = -vel.y * 0.5
          }
        }
      }
    }
  }

  // ----------------------------------------
  // MAIN STEP
  // ----------------------------------------
  step(input, surface, dt) {

    const body = this.body

    // Check boundary collisions
    this.checkBoundaryCollision(surface.roadblocks, surface.boundaries)

    // --- ORIENTATION VECTORS
    const angle = body.angle
    const forward = {
      x: Math.sin(angle),
      y: -Math.cos(angle) // Up is negative Y in screen coordinates
    }
    const right = {
      x: Math.cos(angle),
      y: Math.sin(angle)
    }

    const vel = body.velocity

    // --- VELOCITY DECOMPOSITION
    const vForward = vel.x * forward.x + vel.y * forward.y
    const vLateral = vel.x * right.x + vel.y * right.y
    const speed = Math.hypot(vel.x, vel.y)

    // Limit backward speed
    if (vForward < -this.maxBackwardSpeed) {
      const scale = -this.maxBackwardSpeed / vForward
      Body.setVelocity(body, {
        x: vel.x * scale,
        y: vel.y * scale
      })
    }

    // ----------------------------------------
    // LATERAL GRIP (THIS IS CRITICAL)
    // ----------------------------------------
    // When wheels are aligned with car (going forward), use full grip (no lateral movement)
    // Lateral movement only occurs when:
    // 1. Turning AND gas applied (forward motion)
    // 2. OR handbrake applied AND car moving AND turned wheels
    const isTurning = Math.abs(input.steer) > 0.01
    const isGasApplied = input.throttle > 0
    const isHandbrakeApplied = input.handbrake
    const isMoving = speed > 0.5

    const shouldAllowLateralMovement = (isTurning && isGasApplied) ||
                                       (isHandbrakeApplied && isMoving && isTurning)

    // ----------------------------------------
    // THROTTLE / BRAKE
    // ----------------------------------------
    // Apply throttle/brake force only when accelerating or not in full grip
    const throttleForce = input.throttle * this.maxForce
    const brakeForce = input.brake * this.brakeForce

    // Only apply force when accelerating, braking, or not in full grip
    if (isGasApplied || input.brake > 0 || shouldAllowLateralMovement) {
      // apply force in direction of current velocity (not forward direction)
      if (speed > 0.1) {
        const velDirection = {
          x: vel.x / speed,
          y: vel.y / speed
        }
        Body.applyForce(body, body.position, {
          x: velDirection.x * (throttleForce - brakeForce),
          y: velDirection.y * (throttleForce - brakeForce)
        })
      } else {
        // apply force in forward direction when not moving
        Body.applyForce(body, body.position, {
          x: forward.x * (throttleForce - brakeForce),
          y: forward.y * (throttleForce - brakeForce)
        })
      }
    }

    // When turning, align velocity with front wheel direction (move in direction it's facing)
    if (isTurning && isMoving) {
      // Calculate front wheel direction based on steering angle
      const wheelAngle = input.steer * 0.5 // Steering angle in radians
      const wheelDirection = {
        x: Math.sin(angle + wheelAngle),
        y: -Math.cos(angle + wheelAngle)
      }
      const newVel = {
        x: wheelDirection.x * speed,
        y: wheelDirection.y * speed
      }
      Body.setVelocity(body, newVel)
    } else if (isMoving && !isTurning) {
      // When wheels are aligned forward, eliminate lateral velocity
      // Keep only forward velocity component
      const newVel = {
        x: forward.x * speed,
        y: forward.y * speed
      }
      Body.setVelocity(body, newVel)
    }

    // Apply lateral impulse when conditions are met (increased forces at lower speeds)
    if (shouldAllowLateralMovement) {
      let grip
      if (isGasApplied) {
        // More prone to lateral forces at lower speeds when accelerating
        const speedFactor = Math.max(0.1, Math.min(1, speed / 8))
        grip = this.grip * (0.2 + speedFactor * 0.4) * (surface.grip || 1) // 0.2 to 0.6 grip

        // Lose grip when applying gas at too much angle
        const steerAngle = Math.abs(input.steer)
        const maxSafeAngle = 0.7 // Maximum safe steering angle before losing grip
        if (steerAngle > maxSafeAngle) {
          const gripReduction = 1 - ((steerAngle - maxSafeAngle) * 2) // Reduce grip based on how much over the limit
          grip = grip * Math.max(0.1, gripReduction)
        }
      } else {
        // Handbrake case
        grip = this.grip * 0.3 * (surface.grip || 1)
      }
      const lateralImpulse = {
        x: -right.x * vLateral * grip * 0.5,
        y: -right.y * vLateral * grip * 0.5
      }
      Body.setVelocity(body, {
        x: vel.x + lateralImpulse.x,
        y: vel.y + lateralImpulse.y
      })
    }

    // ----------------------------------------
    // STEERING (TORQUE)
    // ----------------------------------------
    const steer = input.steer

    // Only apply steering if tyres are turned and there is some speed
    if (Math.abs(steer) > 0.01 && speed > 0.5) {
      // Front tires emit force dependent on speed necessary for turning
      const turnForce = speed * 0.03 // Force proportional to speed
      const steerScale = Math.max(0.05, Math.min(0.6, turnForce))

      Body.setAngularVelocity(
        body,
        body.angularVelocity + steer * this.steerTorque * steerScale
      )
    } else {
      // Stop rotation when no steering input (regardless of speed)
      Body.setAngularVelocity(body, 0)
    }

    // ----------------------------------------
    // HAND BRAKE (drift trigger)
    // ----------------------------------------
    if (input.handbrake) {
      // Calculate forward velocity component
      const vForward = vel.x * forward.x + vel.y * forward.y

      // Only apply braking force if moving forward (prevent reversing)
      if (vForward > 0.1) {
        const reverseForce = this.maxForce * 0.8 // Slightly less than full throttle
        Body.applyForce(body, body.position, {
          x: -forward.x * reverseForce,
          y: -forward.y * reverseForce
        })
      }

      // Clamp velocity to zero when very slow (don't reverse) - stop around 10km/h (2.78 units)
      if (speed < 2.78) {
        Body.setVelocity(body, { x: 0, y: 0 })
      }

      // Allow slip in the back - reduce lateral grip when handbrake is active AND conditions are met
      // Only apply lateral impulse when turning and moving
      // More prone to lateral forces at higher speeds when turning with handbrake (2x faster)
      if (isTurning && isMoving) {
        const speedFactor = Math.max(0.2, Math.min(1, speed / 15))
        const handbrakeGrip = this.grip * (0.2 + speedFactor * 0.4) // 0.2 to 0.6 grip (2x, more lateral at higher speeds)
        const lateralImpulse = {
          x: -right.x * vLateral * handbrakeGrip * 0.4, // 2x
          y: -right.y * vLateral * handbrakeGrip * 0.4
        }
        Body.setVelocity(body, {
          x: vel.x + lateralImpulse.x,
          y: vel.y + lateralImpulse.y
        })
      }
    }

    // ----------------------------------------
    // STEP ENGINE
    // ----------------------------------------
    Engine.update(this.engine, dt * 1000)

    // ----------------------------------------
    // OUTPUT STATE
    // ----------------------------------------
    const newVel = body.velocity
    const newForward = {
      x: Math.sin(body.angle),
      y: -Math.cos(body.angle) // Up is negative Y in screen coordinates
    }
    const newRight = {
      x: Math.cos(body.angle),
      y: Math.sin(body.angle)
    }

    const vf = newVel.x * newForward.x + newVel.y * newForward.y
    const vl = newVel.x * newRight.x + newVel.y * newRight.y

    const slip = Math.atan2(Math.abs(vl), Math.max(1, Math.abs(vf)))

    return {
      x: body.position.x,
      y: body.position.y,
      angle: body.angle,
      speed: Math.hypot(newVel.x, newVel.y),
      slip,
      drifting: slip > 0.3,
      vx: newVel.x,
      vy: newVel.y,
      forwardX: newForward.x,
      forwardY: newForward.y,
      rightX: newRight.x,
      rightY: newRight.y
    }
  }

  reset() {
    Body.setPosition(this.body, { x: 0, y: -200 }) // Spawn further up the road
    Body.setVelocity(this.body, { x: 0, y: 0 })
    Body.setAngularVelocity(this.body, 0)
    Body.setAngle(this.body, 0)
  }
}
