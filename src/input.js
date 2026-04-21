// ==============================
// INPUT SYSTEM (UNIFIED ABSTRACTION)
// ==============================

export class InputSystem {
  constructor() {
    this.state = {
      steer: 0,
      throttle: 0,
      brake: 0,
      handbrake: 0
    }

    this.keys = {}
    this.gamepadIndex = null

    this._setupKeyboard()
    this._setupGamepad()
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true
    })

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
    })
  }

  _setupGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index
    })

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null
      }
    })
  }

  update() {
    // Reset to neutral
    let steer = 0
    let throttle = 0
    let brake = 0
    let handbrake = 0

    // Keyboard input
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) steer -= 1
    if (this.keys['ArrowRight'] || this.keys['KeyD']) steer += 1
    if (this.keys['ArrowUp'] || this.keys['KeyW']) throttle = 1
    if (this.keys['ArrowDown'] || this.keys['KeyS']) brake = 1
    if (this.keys['Space']) handbrake = 1

    // Gamepad input (overrides keyboard if connected)
    if (this.gamepadIndex !== null) {
      const gamepad = navigator.getGamepads()[this.gamepadIndex]
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
    this.state.steer += (steer - this.state.steer) * 0.2
    this.state.throttle += (throttle - this.state.throttle) * 0.3
    this.state.brake += (brake - this.state.brake) * 0.3
    this.state.handbrake = handbrake

    return this.state
  }
}
