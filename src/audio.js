// ==============================
// AUDIO SYSTEM (PROCEDURAL SOUND)
// ==============================

export class AudioSystem {
  constructor() {
    this.ctx = null
    this.engineOsc = null
    this.engineGain = null
    this.tireNoise = null
    this.tireGain = null
    this.initialized = false
    this.muted = true
  }

  init() {
    if (this.initialized) return

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      
      // Engine sound (oscillator)
      this.engineOsc = this.ctx.createOscillator()
      this.engineOsc.type = 'sawtooth'
      this.engineOsc.frequency.value = 50

      this.engineGain = this.ctx.createGain()
      this.engineGain.gain.value = 0

      this.engineOsc.connect(this.engineGain)
      this.engineGain.connect(this.ctx.destination)
      this.engineOsc.start()

      // Tire noise (white noise)
      const bufferSize = 2 * this.ctx.sampleRate
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1
      }

      this.tireNoise = this.ctx.createBufferSource()
      this.tireNoise.buffer = noiseBuffer
      this.tireNoise.loop = true

      this.tireGain = this.ctx.createGain()
      this.tireGain.gain.value = 0

      this.tireNoise.connect(this.tireGain)
      this.tireGain.connect(this.ctx.destination)
      this.tireNoise.start()

      this.initialized = true
    } catch (e) {
      console.warn('Audio initialization failed:', e)
    }
  }

  update(carState) {
    if (!this.initialized || this.muted) return

    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    // Engine sound based on speed
    const speed = carState.speed
    const engineFreq = 50 + speed * 10
    const engineVol = Math.min(0.3, speed * 0.01)

    this.engineOsc.frequency.setTargetAtTime(engineFreq, this.ctx.currentTime, 0.1)
    this.engineGain.gain.setTargetAtTime(engineVol, this.ctx.currentTime, 0.1)

    // Tire squeal based on slip angle
    const tireVol = carState.drifting ? Math.min(0.5, carState.slip * 0.5) : 0
    this.tireGain.gain.setTargetAtTime(tireVol, this.ctx.currentTime, 0.05)
  }

  toggleMute() {
    this.muted = !this.muted
    // Initialize audio context if not already initialized
    if (!this.initialized) {
      this.init()
    }
    return this.muted
  }

  playCollision() {
    if (!this.initialized) return

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'square'
    osc.frequency.value = 150
    gain.gain.value = 0.3

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2)
    osc.stop(this.ctx.currentTime + 0.2)
  }
}
