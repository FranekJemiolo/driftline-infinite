// ==============================
// CAR PHYSICS (RWD DRIFT MODEL)
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
    this.yawRate = 0

    this.mass = 1.0

    this.gripFront = 1.2
    this.gripRear = 1.0

    this.drift = 0
  }

  // -----------------------------------------
  // MAIN STEP
  // -----------------------------------------
  step(input, surface, dt) {

    const forwardX = Math.sin(this.angle)
    const forwardY = Math.cos(this.angle)

    const rightX = Math.cos(this.angle)
    const rightY = -Math.sin(this.angle)

    // velocity decomposition
    const vF = this.vx * forwardX + this.vy * forwardY
    const vL = this.vx * rightX + this.vy * rightY

    // slip angle (core drift signal)
    const slip = Math.atan2(Math.abs(vL), Math.max(1, Math.abs(vF)))

    // -----------------------------------------
    // GRIP MODEL (surface aware)
    // -----------------------------------------
    const rearGrip = this.gripRear * surface.grip
    const frontGrip = this.gripFront * surface.grip

    // handbrake reduces rear grip
    const rearGripMod = input.handbrake ? rearGrip * 0.2 : rearGrip

    // throttle reduces rear stability
    const throttleSlipBoost = input.throttle * 0.5

    // -----------------------------------------
    // YAW (steering physics)
    // -----------------------------------------
    const steer = input.steer * 0.6

    const yawForce =
      (steer * frontGrip) -
      (vL * rearGripMod * 0.002) +
      throttleSlipBoost

    this.yawRate += yawForce * dt
    this.angle += this.yawRate * dt

    // -----------------------------------------
    // ENGINE FORCE
    // -----------------------------------------
    const engine = input.throttle * 900
    const brake = input.brake * 600

    let newVF = vF + (engine - brake) * dt

    // lateral friction
    let newVL = vL * (1 - frontGrip * 0.02)

    // -----------------------------------------
    // RECOMPOSE VELOCITY
    // -----------------------------------------
    this.vx =
      forwardX * newVF +
      rightX * newVL

    this.vy =
      forwardY * newVF +
      rightY * newVL

    // -----------------------------------------
    // POSITION INTEGRATION
    // -----------------------------------------
    this.x += this.vx * dt
    this.y += this.vy * dt

    // -----------------------------------------
    // DRIFT METRIC
    // -----------------------------------------
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
