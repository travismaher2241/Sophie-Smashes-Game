import { TERRAIN_TYPES, identifyTerrainFromColor } from '../utils/TerrainTypes.js';

/**
 * 3D Top-Down Golf Ball Physics Engine & Final Shot Calculator
 * Handles 14-Club Bag & Shot Modes (FULL, PITCH, CHIP, FLOP).
 * Calibrated for Warragul Country Club 724x2172 map scale (~5.68 pixels/meter)
 */
export class BallPhysics {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.z = 0; // Altitude off ground

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.radius = 4.5;
    this.inAir = false;
    this.isRolling = false;
    this.isHoled = false;
    this.inHazard = false;

    // Physical constants
    this.gravity = 0.35;
    this.airDrag = 0.992;

    // Current Terrain surface & Shot Mode memory
    this.currentTerrain = TERRAIN_TYPES.TEE_BOX;
    this.currentRollMult = 1.0;

    // Trajectory dot history for arc rendering
    this.trail = [];
  }

  setPosition(x, y, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.inAir = false;
    this.isRolling = false;
    this.isHoled = false;
    this.inHazard = false;
    this.trail = [];
  }

  /**
   * Launch Ball with Hard Shot-Mode Caps & Precision Physics:
   * Full: 100% max club range.
   * Pitch: Capped at 50m max potential.
   * Chip: Capped at 25m max potential.
   * Flop: Capped at 20m max potential.
   */
  launch(params) {
    const {
      aimAngle = -Math.PI / 2,
      club,
      shotType = { id: 'FULL', distMult: 1.0, loftMult: 1.0, rollMult: 1.0 },
      intentionalShape = 0,
      powerInput = 1.0,
      snapError = 0.0,
      overswingPenalty = 0,
      terrainLie = { powerFactor: 1.0, loftFactor: 1.0 },
      slope = { x: 0, y: 0 },
      wind = { speed: 0, dirAngle: 0 },
      officialHoleMeters = 300,
      mapTotalPixelLength = 1745
    } = params;

    const pixelsPerMeter = (mapTotalPixelLength / (officialHoleMeters || 300));
    this.currentShotTypeID = shotType.id || 'FULL';
    this.currentRollMult = (shotType.rollMult || 1.0);

    // 1. HARD SHOT-MODE DISTANCE CAPS (Meters)
    let maxCapMeters = club.maxDistance;
    let modePowerScale = 1.0;

    if (this.currentShotTypeID === 'PITCH') {
      maxCapMeters = Math.min(50, club.maxDistance);
      modePowerScale = 0.70;
    } else if (this.currentShotTypeID === 'CHIP') {
      maxCapMeters = Math.min(25, club.maxDistance);
      modePowerScale = 0.45;
    } else if (this.currentShotTypeID === 'FLOP') {
      maxCapMeters = Math.min(20, club.maxDistance);
      modePowerScale = 0.35;
    }

    const effectivePower = Math.min(1.10, Math.max(0.05, powerInput)) * (terrainLie.powerFactor || 1.0);
    const targetTotalMeters = maxCapMeters * modePowerScale * effectivePower;

    // 2. Separate Carry (Air Flight) vs Roll Ratio:
    let carryRatio = 0.85;
    if (this.currentShotTypeID === 'PITCH') carryRatio = 0.75;
    if (this.currentShotTypeID === 'CHIP') carryRatio = 0.35;
    if (this.currentShotTypeID === 'FLOP') carryRatio = 0.90;

    const carryMeters = targetTotalMeters * carryRatio;
    const carryPixels = carryMeters * pixelsPerMeter;

    // 3. Final Shot Angle (Hook/Slice curve applied strictly on snapError)
    const overswingDrift = (Math.random() - 0.5) * overswingPenalty * 0.08;
    const slopeAngleOffset = (slope.x * 0.03);
    const totalAngle = aimAngle + intentionalShape + (snapError * 0.22) + overswingDrift + slopeAngleOffset;

    if (club.isPutter) {
      // Putting ground roll
      const putterSpeed = (targetPixels / 45);
      this.vx = Math.cos(totalAngle) * putterSpeed;
      this.vy = Math.sin(totalAngle) * putterSpeed;
      this.vz = 0;
      this.inAir = false;
      this.isRolling = true;
    } else {
      // 3D Flight Trajectory
      this.gravity = 0.35;
      this.airDrag = 0.995;

      let flightTime = 38 + (club.loft * 0.4);
      if (this.currentShotTypeID === 'CHIP') flightTime = 18;
      if (this.currentShotTypeID === 'PITCH') flightTime = 30;
      if (this.currentShotTypeID === 'FLOP') flightTime = 42;

      this.vz = (flightTime / 2) * this.gravity;
      const requiredVGround = carryPixels / flightTime;

      this.vx = Math.cos(totalAngle) * requiredVGround;
      this.vy = Math.sin(totalAngle) * requiredVGround;

      this.inAir = true;
      this.isRolling = false;
    }

    this.trail = [];
    this.isHoled = false;
    this.inHazard = false;
  }

  update(terrainPixelSampleCallback, wind = { speed: 0, dirAngle: 0 }, audioEngine = null, dt = 1) {
    if (this.isHoled || (!this.inAir && !this.isRolling && Math.hypot(this.vx, this.vy) < 0.05)) {
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      this.isRolling = false;
      return;
    }

    if (this.inAir && Math.random() < 0.35 * dt) {
      this.trail.push({ x: this.x, y: this.y, z: this.z });
      if (this.trail.length > 30) this.trail.shift();
    }

    if (this.inAir) {
      this.vx *= Math.pow(this.airDrag, dt);
      this.vy *= Math.pow(this.airDrag, dt);

      // Scaled wind effect (gentle impact on short game shots)
      const windFactor = (this.currentShotTypeID === 'FULL') ? 0.004 : 0.001;
      const windRad = (wind.dirAngle * Math.PI) / 180;
      this.vx += Math.cos(windRad) * wind.speed * windFactor * dt;
      this.vy += Math.sin(windRad) * wind.speed * windFactor * dt;

      this.vz -= this.gravity * dt;

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.z += this.vz * dt;

      if (this.z <= 0) {
        this.z = 0;

        if (terrainPixelSampleCallback) {
          const color = terrainPixelSampleCallback(this.x, this.y);
          this.currentTerrain = identifyTerrainFromColor(color.r, color.g, color.b, color.a);
        }

        if (this.currentTerrain.isHazard) {
          this.inAir = false;
          this.isRolling = false;
          this.inHazard = true;
          this.vx = 0;
          this.vy = 0;
          this.vz = 0;
          if (audioEngine) audioEngine.playWaterSplash();
          return;
        }

        // Short Game Landing Damping: Pitch/Chip/Flop deadens bounce & momentum
        const isShortGame = (this.currentShotTypeID === 'PITCH' || this.currentShotTypeID === 'CHIP' || this.currentShotTypeID === 'FLOP');
        const restitution = isShortGame ? 0.12 : (this.currentTerrain.restitution || 0.45);
        const bounceVz = -this.vz * restitution;

        if (bounceVz > 1.2 && !isShortGame) {
          this.vz = bounceVz;
          this.vx *= 0.65;
          this.vy *= 0.65;
          if (audioEngine) audioEngine.playBounce(Math.min(0.4, bounceVz / 8));
        } else {
          // Transition immediately to ground roll
          this.vz = 0;
          this.inAir = false;
          this.isRolling = true;

          if (isShortGame) {
            const isChip = (this.currentShotTypeID === 'CHIP');
            const landingDamp = isChip ? 0.45 : 0.22; // Pitch/Flop deadens to 22%, Chip to 45%
            this.vx *= landingDamp;
            this.vy *= landingDamp;
          } else {
            this.vx *= 0.60;
            this.vy *= 0.60;
          }

          if (audioEngine) audioEngine.playBounce(0.12);
        }
      }
    } else if (this.isRolling) {
      if (terrainPixelSampleCallback) {
        const color = terrainPixelSampleCallback(this.x, this.y);
        this.currentTerrain = identifyTerrainFromColor(color.r, color.g, color.b, color.a);
      }

      if (this.currentTerrain.isHazard) {
        this.isRolling = false;
        this.inHazard = true;
        this.vx = 0;
        this.vy = 0;
        if (audioEngine) audioEngine.playWaterSplash();
        return;
      }

      // Apply Terrain Surface Friction (Pitch & Chip deaden quickly on fairway/fringe)
      let baseFriction = this.currentTerrain.friction || 0.85;
      if (this.currentTerrain.id === 'GREEN') {
        baseFriction = 0.92;
      } else if (this.currentShotTypeID === 'PITCH' || this.currentShotTypeID === 'CHIP' || this.currentShotTypeID === 'FLOP') {
        baseFriction = 0.72; // High friction for short game touch
      }

      const rollFriction = Math.min(0.93, baseFriction * (0.65 + this.currentRollMult * 0.30));
      this.vx *= Math.pow(rollFriction, dt);
      this.vy *= Math.pow(rollFriction, dt);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (Math.hypot(this.vx, this.vy) < 0.08) {
        this.vx = 0;
        this.vy = 0;
        this.isRolling = false;
      }
    }
  }

  render(ctx) {
    if (this.isHoled) return;

    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    const shadowX = this.x + (this.z * 0.45);
    const shadowY = this.y - (this.z * 0.6);
    const shadowScale = Math.max(0.4, 1 - (this.z / 120));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, this.radius * shadowScale * 1.3, this.radius * shadowScale * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    const ballScale = 1 + (this.z / 90);
    const renderY = this.y - this.z;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, renderY, this.radius * ballScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
