// ==============================
// ROAD SYSTEM (PURE GEOMETRY)
// ==============================

export class RoadSystem {
  constructor(seed = 1) {
    this.seed = seed
    this.segments = []
    this.width = 140
    this.laneCount = 3
    this.segmentLength = 8

    this._rng = mulberry32(seed)
  }

  generate(count = 2000) {
    let x = 0, y = 0, angle = 0

    for (let i = 0; i < count; i++) {

      // deterministic curvature field
      const noise =
        Math.sin(i * 0.02) * 0.7 +
        Math.sin(i * 0.007) * 0.3 +
        (this._rng() - 0.5) * 0.2

      angle += noise * 0.03

      x += Math.sin(angle) * this.segmentLength
      y += Math.cos(angle) * this.segmentLength

      const nx = Math.cos(angle)
      const ny = -Math.sin(angle)

      this.segments.push({
        index: i,
        x,
        y,
        nx,
        ny,
        angle,
        width: this.width,
        laneCount: this.laneCount
      })
    }
  }

  // -----------------------------------------
  // SPATIAL QUERY: closest segment (sliding window optimized externally)
  // -----------------------------------------
  closestSegment(px, py, start = 0, range = 40) {
    let best = null
    let bestD = Infinity

    const end = Math.min(this.segments.length, start + range)

    for (let i = start; i < end; i++) {
      const s = this.segments[i]

      const dx = px - s.x
      const dy = py - s.y
      const d = dx * dx + dy * dy

      if (d < bestD) {
        bestD = d
        best = s
      }
    }

    return best
  }

  // -----------------------------------------
  // SURFACE SAMPLING (bridge to physics)
  // -----------------------------------------
  sampleSurface(px, py, segment) {
    if (!segment) return { grip: 1.0, normalX: 0, normalY: 1 }

    return {
      grip: 1.0,
      normalX: segment.nx,
      normalY: segment.ny
    }
  }

  // -----------------------------------------
  // LANE POSITION HELPER
  // -----------------------------------------
  getLaneOffset(laneIndex) {
    const center = (this.laneCount - 1) / 2
    const laneWidth = this.width / this.laneCount
    return (laneIndex - center) * laneWidth
  }
}

// deterministic RNG
export function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
