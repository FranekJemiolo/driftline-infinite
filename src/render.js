// ==============================
// RENDER SYSTEM (CANVAS 2D)
// ==============================

export class RenderSystem {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      angle: 0,
      targetAngle: 0
    }
    this.zoom = 1.0
    this.skidMarks = []
    this.particles = []
    this.resize()

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const zoomSpeed = 0.001
      this.zoom -= e.deltaY * zoomSpeed
      this.zoom = Math.max(0.25, Math.min(2.0, this.zoom))
    }, { passive: false })
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  updateCamera(car, road) {
    // Velocity-based lookahead
    const speed = Math.hypot(car.vx, car.vy)
    const lookahead = speed * 0.3

    const forwardX = Math.sin(car.angle)
    const forwardY = Math.cos(car.angle)

    this.camera.targetX = car.x + forwardX * lookahead
    this.camera.targetY = car.y + forwardY * lookahead

    // Smooth camera follow
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1

    // Turn-based rotation bias
    this.camera.targetAngle = car.yawRate * 0.3
    this.camera.angle += (this.camera.targetAngle - this.camera.angle) * 0.1
  }

  worldToScreen(wx, wy) {
    const cx = this.canvas.width / 2
    const cy = this.canvas.height / 2

    const dx = wx - this.camera.x
    const dy = wy - this.camera.y

    // Apply camera rotation
    const cos = Math.cos(-this.camera.angle)
    const sin = Math.sin(-this.camera.angle)

    const rx = dx * cos - dy * sin
    const ry = dx * sin + dy * cos

    // Apply zoom scale
    const zoomedX = rx * this.zoom
    const zoomedY = ry * this.zoom

    // Invert Y axis so positive world Y moves up on screen
    return {
      x: cx + zoomedX,
      y: cy - zoomedY
    }
  }

  clear() {
    this.ctx.fillStyle = '#1a1a2e'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  renderRoad(road) {
    const ctx = this.ctx

    if (road.segments.length < 2) return

    // Draw road as connected lines
    for (let i = 0; i < road.segments.length - 1; i++) {
      const seg = road.segments[i]
      const nextSeg = road.segments[i + 1]

      const screen = this.worldToScreen(seg.x, seg.y)
      const nextScreen = this.worldToScreen(nextSeg.x, nextSeg.y)

      // Draw road surface as thick line
      ctx.strokeStyle = seg.isParkingLot ? '#555' : '#444'
      ctx.lineWidth = seg.width * this.zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(screen.x, screen.y)
      ctx.lineTo(nextScreen.x, nextScreen.y)
      ctx.stroke()

      // Draw lane markers
      if (seg.lanes > 1) {
        ctx.strokeStyle = seg.isParkingLot ? '#777' : '#fff'
        ctx.lineWidth = 2 * this.zoom
        ctx.setLineDash([10 * this.zoom, 10 * this.zoom])

        const laneWidth = seg.width / seg.lanes
        for (let j = 1; j < seg.lanes; j++) {
          const offset = (j - seg.lanes / 2) * laneWidth
          const laneX1 = screen.x + offset * seg.nx * this.zoom
          const laneY1 = screen.y + offset * seg.ny * this.zoom
          const laneX2 = nextScreen.x + offset * nextSeg.nx * this.zoom
          const laneY2 = nextScreen.y + offset * nextSeg.ny * this.zoom

          ctx.beginPath()
          ctx.moveTo(laneX1, laneY1)
          ctx.lineTo(laneX2, laneY2)
          ctx.stroke()
        }

        ctx.setLineDash([])
      }
    }
  }

  renderCar(car, carImage) {
    const ctx = this.ctx
    const screen = this.worldToScreen(car.x, car.y)

    ctx.save()
    ctx.translate(screen.x, screen.y)
    ctx.rotate(-car.angle)

    if (carImage && carImage.complete && carImage.naturalWidth > 0) {
      ctx.drawImage(carImage, -20, -40, 40, 80)
    } else {
      // Fallback: draw car as rectangle with border for visibility
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(-20, -40, 40, 80)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.strokeRect(-20, -40, 40, 80)
      
      // Add direction indicator
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-5, -45, 10, 10)
    }

    ctx.restore()
  }

  renderSkidMarks() {
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.5)'
    ctx.lineWidth = 4

    for (const mark of this.skidMarks) {
      const screen = this.worldToScreen(mark.x, mark.y)
      
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, 2, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Limit skid marks
    if (this.skidMarks.length > 500) {
      this.skidMarks = this.skidMarks.slice(-500)
    }
  }

  addSkidMark(x, y) {
    this.skidMarks.push({ x, y })
  }

  renderParticles() {
    const ctx = this.ctx

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      const screen = this.worldToScreen(p.x, p.y)

      ctx.fillStyle = `rgba(200, 200, 200, ${p.life})`
      ctx.beginPath()
      ctx.arc(screen.x, screen.y, p.size, 0, Math.PI * 2)
      ctx.fill()

      p.x += p.vx
      p.y += p.vy
      p.life -= 0.02

      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  addParticle(x, y, vx, vy) {
    this.particles.push({
      x, y, vx, vy,
      size: 3 + Math.random() * 3,
      life: 1.0
    })
  }

  renderUI(car, score, onRoad = true, gameOver = false, debugInfo = null) {
    const ctx = this.ctx

    // Speed display
    const speed = Math.hypot(car.vx, car.vy) * 3.6 // Convert to km/h
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px Arial'
    ctx.fillText(`${Math.floor(speed)} km/h`, 20, 40)

    // Drift score
    ctx.fillStyle = car.drifting ? '#ffcc00' : '#fff'
    ctx.fillText(`Score: ${Math.floor(score)}`, 20, 70)

    // Drift angle indicator
    const driftAngle = car.drift * (180 / Math.PI)
    ctx.fillStyle = car.drifting ? '#ff4444' : '#666'
    ctx.fillText(`Drift: ${Math.floor(driftAngle)}°`, 20, 100)

    // Off-road warning
    if (!onRoad) {
      ctx.fillStyle = '#ff4444'
      ctx.font = 'bold 20px Arial'
      ctx.fillText('OFF ROAD!', 20, 130)
    }

    // Debug info
    if (debugInfo && debugInfo.enabled) {
      ctx.fillStyle = '#00ff00'
      ctx.font = '14px monospace'
      const debugX = 20
      let debugY = 160

      // Input highlighting
      const throttleColor = debugInfo.throttle > 0.1 ? '#00ff00' : '#666'
      const brakeColor = debugInfo.brake > 0.1 ? '#ff0000' : '#666'
      const handbrakeColor = debugInfo.handbrake ? '#ff0000' : '#666'
      const steerColor = Math.abs(debugInfo.steer) > 0.1 ? '#ffff00' : '#666'

      const lines = [
        `Speed: ${speed.toFixed(1)} km/h (${(speed / 3.6).toFixed(1)} m/s)`,
        `Forward Vel: ${debugInfo.vF.toFixed(2)} m/s`,
        `Lateral Vel: ${debugInfo.vL.toFixed(2)} m/s`,
        `Slip Angle: ${(debugInfo.slip * 180 / Math.PI).toFixed(1)}°`,
        `Throttle: ${debugInfo.throttle.toFixed(2)}`,
        `Brake: ${debugInfo.brake.toFixed(2)}`,
        `Handbrake: ${debugInfo.handbrake ? 'ON' : 'OFF'}`,
        `Steer: ${debugInfo.steer.toFixed(2)}`,
        `Grip: ${(debugInfo.grip * 100).toFixed(0)}%`,
        `Engine Force: ${debugInfo.engineForce.toFixed(2)} N`,
        `Brake Force: ${debugInfo.brakeForce.toFixed(2)} N`,
        `Yaw Rate: ${(debugInfo.yawRate * 180 / Math.PI).toFixed(1)}°/s`,
        `Car Angle: ${(car.angle * 180 / Math.PI).toFixed(1)}°`,
        `Car Pos: (${car.x.toFixed(1)}, ${car.y.toFixed(1)})`
      ]

      for (const line of lines) {
        ctx.fillText(line, debugX, debugY)
        debugY += 20
      }

      // Input indicators
      ctx.font = 'bold 16px monospace'
      const inputY = 440
      ctx.fillStyle = throttleColor
      ctx.fillText(`W/↑`, debugX, inputY)
      ctx.fillStyle = brakeColor
      ctx.fillText(`S/↓`, debugX + 50, inputY)
      ctx.fillStyle = handbrakeColor
      ctx.fillText(`SPACE`, debugX + 100, inputY)
      ctx.fillStyle = steerColor
      ctx.fillText(`A/←`, debugX + 160, inputY)
      ctx.fillText(`D/→`, debugX + 210, inputY)
    }

    // Game over screen
    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      ctx.fillStyle = '#ff4444'
      ctx.font = 'bold 48px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30)

      ctx.fillStyle = '#fff'
      ctx.font = '24px Arial'
      ctx.fillText(`Final Score: ${Math.floor(score)}`, this.canvas.width / 2, this.canvas.height / 2 + 20)

      ctx.fillStyle = '#ccc'
      ctx.font = '18px Arial'
      ctx.fillText('Refresh to restart', this.canvas.width / 2, this.canvas.height / 2 + 60)
      ctx.textAlign = 'left'
    }
  }
}
