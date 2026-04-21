// ==============================
// DRIFT SCORING SYSTEM
// ==============================

export class ScoringSystem {
  constructor() {
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.currentDriftTime = 0
    this.totalDriftTime = 0
    this.driftActive = false
  }

  update(carState, dt) {
    if (carState.drifting) {
      if (!this.driftActive) {
        // Start new drift
        this.driftActive = true
        this.currentDriftTime = 0
      }

      this.currentDriftTime += dt
      this.totalDriftTime += dt

      // Score based on drift angle and speed
      const angleScore = carState.slip * 100
      const speedScore = carState.speed * 2
      const driftScore = (angleScore + speedScore) * dt

      this.combo += 1
      this.maxCombo = Math.max(this.maxCombo, this.combo)

      // Combo multiplier
      const multiplier = 1 + (this.combo * 0.1)
      this.score += driftScore * multiplier

    } else {
      if (this.driftActive) {
        // End drift - bank the score
        this.driftActive = false
        this.combo = 0
      }
    }

    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      driftActive: this.driftActive,
      currentDriftTime: this.currentDriftTime,
      totalDriftTime: this.totalDriftTime
    }
  }

  reset() {
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.currentDriftTime = 0
    this.totalDriftTime = 0
    this.driftActive = false
  }
}
