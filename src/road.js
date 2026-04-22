// ==============================
// ROAD SYSTEM (PURE GEOMETRY)
// ==============================

export class Road {
  constructor(seed = 1, roadType = 'curved') {
    this.seed = seed
    this.roadType = roadType
    this.segments = []
    this.width = 2366 // 6 lanes * 394.3 (1.5x of 262.8)
    this.laneCount = 6
    this.segmentLength = 80

    this.rng = mulberry32(seed)
  }

  generate(count = 2000) {
    let x = 0, y = 0
    const angle = 0 // Always straight up

    // Add road extending in both directions (up and down)
    const screenHeight = 1080
    const bottomExtension = (screenHeight / this.segmentLength) * 2 + 20 // Extend further down
    const topExtension = count // Extend upwards

    // Generate road going down (+Y direction) first
    for (let i = 0; i < bottomExtension; i++) {
      x += Math.sin(angle) * this.segmentLength
      y += Math.cos(angle) * this.segmentLength // + direction (down)

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
        laneCount: this.laneCount,
        isParkingLot: false
      })
    }

    // Reset to origin and generate road going up (-Y direction)
    x = 0
    y = 0
    const startIndex = this.segments.length

    for (let i = 0; i < topExtension; i++) {
      x += Math.sin(angle) * this.segmentLength
      y -= Math.cos(angle) * this.segmentLength // - direction (up)

      const nx = Math.cos(angle)
      const ny = -Math.sin(angle)

      this.segments.push({
        index: startIndex + i,
        x,
        y,
        nx,
        ny,
        angle,
        width: this.width,
        laneCount: this.laneCount,
        isParkingLot: false
      })
    }

    // Add road boundaries (left and right edges at fixed positions +/- 2000)
    this.boundaries = []
    const boundaryX = 2000 // Fixed boundary position

    // Generate vertical boundary lines at +/- 2000
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i]

      this.boundaries.push({
        type: 'left',
        x: -boundaryX,
        y: seg.y,
        nx: 1, // Normal pointing right
        ny: 0
      })
      this.boundaries.push({
        type: 'right',
        x: boundaryX,
        y: seg.y,
        nx: -1, // Normal pointing left
        ny: 0
      })
    }

    // Add grey rectangles as roadblocks at the bottom (extending across whole highway)
    this.roadblocks = []
    const roadblockHeight = 50
    const roadblockWidth = 4000 // Span from -2000 to 2000
    const roadblockY = 1800 // Position at Y = 1800

    this.roadblocks.push({
      x: 0,
      y: roadblockY,
      width: roadblockWidth,
      height: roadblockHeight,
      top: roadblockY - roadblockHeight / 2, // Top edge for collision
      bottom: roadblockY + roadblockHeight / 2, // Bottom edge for collision
      left: -roadblockWidth / 2, // Left edge for collision
      right: roadblockWidth / 2 // Right edge for collision
    })

    // Add lane arrows going up at the beginning of the road (around 0,0)
    this.laneArrows = []
    const laneWidth = this.width / this.laneCount
    const arrowY = 0 // At the beginning of the road

    for (let i = 0; i < this.laneCount; i++) {
      const laneX = -this.width / 2 + laneWidth / 2 + i * laneWidth
      this.laneArrows.push({
        x: laneX,
        y: arrowY,
        angle: 0 // Pointing up
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

  getSegmentAt(px, py) {
    return this.closestSegment(px, py)
  }

  // -----------------------------------------
  // SURFACE SAMPLING (bridge to physics)
  // -----------------------------------------
  sampleSurface(px, py, segment) {
    if (!segment) return { grip: 1.0, normalX: 0, normalY: 1, onRoad: false }

    // Calculate lateral offset from road center
    const dx = px - segment.x
    const dy = py - segment.y
    const lateralOffset = dx * segment.nx + dy * segment.ny

    const halfWidth = segment.width / 2
    const onRoad = Math.abs(lateralOffset) <= halfWidth

    // Off-road grip reduction
    const grip = onRoad ? 1.0 : 0.3

    return {
      grip,
      normalX: segment.nx,
      normalY: segment.ny,
      onRoad,
      lateralOffset
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

  // -----------------------------------------
  // ROAD BOUNDS CHECK
  // -----------------------------------------
  isOnRoad(px, py, segment) {
    if (!segment) return false

    const dx = px - segment.x
    const dy = py - segment.y
    const lateralOffset = dx * segment.nx + dy * segment.ny

    return Math.abs(lateralOffset) <= segment.width / 2
  }

  // -----------------------------------------
  // DYNAMIC ROAD GENERATION
  // -----------------------------------------
  extendRoad(targetIndex) {
    const angle = 0 // Always straight up

    while (this.segments.length <= targetIndex) {
      const last = this.segments[this.segments.length - 1]
      const nextIndex = this.segments.length

      const x = last.x + Math.sin(angle) * this.segmentLength
      const y = last.y - Math.cos(angle) * this.segmentLength

      const nx = Math.cos(angle)
      const ny = -Math.sin(angle)

      this.segments.push({
        index: nextIndex,
        x, y, angle,
        nx, ny,
        width: this.width,
        laneCount: this.laneCount,
        isParkingLot: false
      })
    }
  }

  cleanupRoad(keepBehindCount) {
    if (this.segments.length <= keepBehindCount) return

    const removeCount = this.segments.length - keepBehindCount
    this.segments.splice(0, removeCount)

    // Renumber segments
    this.segments.forEach((seg, i) => {
      seg.index = i
    })
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
