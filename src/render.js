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

    this.skidMarks = []
    this.particles = []
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

    return {
      x: cx + rx,
      y: cy + ry
    }
  }

  clear() {
    this.ctx.fillStyle = '#1a1a2e'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  renderRoad(road) {
    const ctx = this.ctx

    // Render road segments
    ctx.strokeStyle = '#333'
    ctx.lineWidth = road.width

    ctx.beginPath()
    for (let i = 0; i < road.segments.length; i++) {
      const s = road.segments[i]
      const screen = this.worldToScreen(s.x, s.y)

      if (i === 0) {
        ctx.moveTo(screen.x, screen.y)
      } else {
        ctx.lineTo(screen.x, screen.y)
      }
    }
    ctx.stroke()

    // Render lane markings
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.setLineDash([20, 20])

    for (let lane = 0; lane < road.laneCount - 1; lane++) {
      const offset = road.getLaneOffset(lane + 0.5)

      ctx.beginPath()
      for (let i = 0; i < road.segments.length; i++) {
        const s = road.segments[i]
        const lx = s.x + s.nx * offset
        const ly = s.y + s.ny * offset
        const screen = this.worldToScreen(lx, ly)

        if (i === 0) {
          ctx.moveTo(screen.x, screen.y)
        } else {
          ctx.lineTo(screen.x, screen.y)
        }
      }
      ctx.stroke()
    }

    ctx.setLineDash([])
  }

  renderCar(car, carImage) {
    const ctx = this.ctx
    const screen = this.worldToScreen(car.x, car.y)

    ctx.save()
    ctx.translate(screen.x, screen.y)
    ctx.rotate(-car.angle - this.camera.angle)

    if (carImage) {
      ctx.drawImage(carImage, -20, -40, 40, 80)
    } else {
      // Fallback: draw car as rectangle
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(-20, -40, 40, 80)
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

  renderUI(car, score) {
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
  }
}
