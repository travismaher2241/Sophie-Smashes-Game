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
   * Launch Ball with Comprehensive Final Shot Calculator Formula:
   * Supports 14 Golf Clubs & Shot Modes (Full, Pitch, Chip, Flop).
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

    // Pixels per meter scale factor (~5.68 px/m on 724x2172 map)
    const pixelsPerMeter = (mapTotalPixelLength / (officialHoleMeters || 300));

    // Calculate Effective Shot Distance & Roll Factor
    const distMult = shotType.distMult || 1.0;
    const loftMult = shotType.loftMult || 1.0;
    this.currentRollMult = (shotType.rollMult || 1.0);

    const effectivePower = powerInput * (terrainLie.powerFactor || 1.0);
    const targetMeters = club.maxDistance * distMult * effectivePower;
    const targetPixels = targetMeters * pixelsPerMeter;

    // Calculate Final Shot Angle
    const overswingDrift = (Math.random() - 0.5) * overswingPenalty * 0.14;
    const slopeAngleOffset = (slope.x * 0.05);
    const totalAngle = aimAngle + intentionalShape + (snapError * 0.26) + overswingDrift + slopeAngleOffset;

    if (club.isPutter) {
      // Putting ground roll
      const putterSpeed = (targetPixels / 45);
      this.vx = Math.cos(totalAngle) * putterSpeed;
      this.vy = Math.sin(totalAngle) * putterSpeed;
      this.vz = 0;
      this.inAir = false;
      this.isRolling = true;
    } else {
      // 3D Loft Flight Trajectory
      this.gravity = 0.35;
      this.airDrag = 0.992;

      const effectiveLoft = Math.min(68, club.loft * loftMult * (terrainLie.loftFactor || 1.0));
      const flightTime = 36 + (effectiveLoft * 0.5);
      this.vz = (flightTime / 2) * this.gravity;

      // Ground flight velocity calibrated to metric distance
      const requiredVGround = targetPixels / (flightTime * 0.94);

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
      // Exponential decay factors must be raised to dt (not multiplied by it) to stay
      // correct when frame time varies - see Game.js loop() for why dt exists at all.
      this.vx *= Math.pow(this.airDrag, dt);
      this.vy *= Math.pow(this.airDrag, dt);

      const windRad = (wind.dirAngle * Math.PI) / 180;
      const windForceX = Math.cos(windRad) * wind.speed * 0.005 * dt;
      const windForceY = Math.sin(windRad) * wind.speed * 0.005 * dt;
      this.vx += windForceX;
      this.vy += windForceY;

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

        const bounceVz = -this.vz * this.currentTerrain.restitution;

        if (bounceVz > 1.2) {
          this.vz = bounceVz;
          this.vx *= this.currentTerrain.friction * this.currentRollMult;
          this.vy *= this.currentTerrain.friction * this.currentRollMult;
          if (audioEngine) audioEngine.playBounce(Math.min(0.5, bounceVz / 8));
        } else {
          this.vz = 0;
          this.inAir = false;
          this.isRolling = true;
          if (audioEngine) audioEngine.playBounce(0.15);
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

      // Apply Terrain Surface Friction modified by Shot Mode Roll Multiplier
      const rollFriction = Math.min(0.96, (this.currentTerrain.friction || 0.88) * (0.85 + this.currentRollMult * 0.15));
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
