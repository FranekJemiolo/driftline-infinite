// ==============================
// CAR PHYSICS (IFORCE2D MODEL)
// ==============================

export class CarPhysics {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = 0
    this.y = 0

    this.vx = 0
    this.vy = 0

    this.angle = 0
    this.angularVelocity = 0

    this.mass = 1.0
    this.inertia = 1.0

    this.maxForwardSpeed = 50
    this.maxBackwardSpeed = -20
    this.maxDriveForce = 100
    this.maxSteerTorque = 15

    this.drift = 0
  }

  // Get forward velocity component
  getForwardVelocity() {
    const forwardX = Math.sin(this.angle)
    const forwardY = -Math.cos(this.angle) // Up is negative Y in screen coordinates
    const speed = this.vx * forwardX + this.vy * forwardY
    return {
      x: forwardX * speed,
      y: forwardY * speed,
      speed
    }
  }

  // Get lateral (sideways) velocity component
  getLateralVelocity() {
    const rightX = Math.cos(this.angle)
    const rightY = Math.sin(this.angle)
    const speed = this.vx * rightX + this.vy * rightY
    return {
      x: rightX * speed,
      y: rightY * speed,
      speed
    }
  }

  // -----------------------------------------
  // MAIN STEP
  // -----------------------------------------
  step(input, surface, dt) {
    // Kill lateral velocity (sideways friction)
    const lateralVel = this.getLateralVelocity()
    const lateralImpulse = this.mass * -lateralVel.speed
    this.vx += lateralVel.x * lateralImpulse * dt * 0.5 // Very low lateral friction
    this.vy += lateralVel.y * lateralImpulse * dt * 0.5

    // Apply angular damping to prevent spinning
    this.angularVelocity *= 0.95

    // Apply drive force (forward/backward)
    const forwardVel = this.getForwardVelocity()
    let driveForce = 0

    if (input.throttle) {
      if (forwardVel.speed < this.maxForwardSpeed) {
        driveForce = this.maxDriveForce
      }
    } else if (input.brake) {
      if (forwardVel.speed > this.maxBackwardSpeed) {
        driveForce = -this.maxDriveForce
      }
    }

    // Apply drive force in forward direction
    const forwardX = Math.sin(this.angle)
    const forwardY = -Math.cos(this.angle) // Up is negative Y in screen coordinates
    this.vx += forwardX * driveForce * dt
    this.vy += forwardY * driveForce * dt

    // Apply steering torque
    let steerTorque = 0
    if (input.steer !== 0) {
      steerTorque = -input.steer * this.maxSteerTorque
    }
    this.angularVelocity += steerTorque * dt

    // Handbrake - reduces lateral grip and adds braking
    if (input.handbrake) {
      this.vx *= 0.95
      this.vy *= 0.95
    }

    // Update angle
    this.angle += this.angularVelocity * dt

    // Update position (negate Y for screen coordinates)
    this.x += this.vx * dt
    this.y -= this.vy * dt

    // Calculate slip for drift detection
    const lateralVelAfter = this.getLateralVelocity()
    const speed = Math.hypot(this.vx, this.vy)
    const slip = Math.atan2(Math.abs(lateralVelAfter.speed), Math.max(1, speed))

    this.drift = slip

    return {
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      angle: this.angle,
      yawRate: this.angularVelocity,
      slip,
      speed,
      drifting: slip > 0.2,
      vF: forwardVel.speed,
      vL: lateralVelAfter.speed,
      throttle: input.throttle,
      brake: input.brake,
      handbrake: input.handbrake,
      steer: input.steer,
      grip: surface.grip,
      engineForce: driveForce,
      brakeForce: input.brake ? -this.maxDriveForce : 0,
      forwardX,
      forwardY,
      rightX: Math.cos(this.angle),
      rightY: Math.sin(this.angle)
    }
  }
}
