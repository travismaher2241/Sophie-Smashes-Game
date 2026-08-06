import { TERRAIN_TYPES, identifyTerrainFromColor } from '../utils/TerrainTypes.js';

/**
 * 3D Top-Down Golf Ball Physics Engine & Final Shot Calculator
 * 
 * Final ball flight =
 *   aim
 *   + selected club
 *   + intentional shot shape
 *   + power input
 *   + snap error
 *   + overswing penalty
 *   + lie
 *   + slope
 *   + wind
 *   + terrain response
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
    this.inOB = false;

    // Physical constants
    this.gravity = 0.38;
    this.airDrag = 0.988;

    // Terrain surface memory
    this.currentTerrain = TERRAIN_TYPES.TEE_BOX;

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
    this.inOB = false;
    this.trail = [];
  }

  /**
   * Launch Ball with Comprehensive Final Shot Calculator Formula:
   * Final ball flight = aim + selected club + intentional shot shape + power input + snap error + overswing penalty + lie + slope + wind + terrain response
   */
  launch(params) {
    const {
      aimAngle = -Math.PI / 2,
      club,
      intentionalShape = 0, // Draw (-0.08) or Fade (+0.08)
      powerInput = 1.0,     // Partial (<100%), Controlled (=100%), Overswing (>100%)
      snapError = 0.0,      // Early = Hook (-), Perfect = 0, Late = Slice (+)
      overswingPenalty = 0, // Overswing dispersion penalty
      terrainLie = { powerFactor: 1.0, loftFactor: 1.0 },
      slope = { x: 0, y: 0 },
      wind = { speed: 0, dirAngle: 0 }
    } = params;

    // 1. Calculate Base Distance & Power Input & Lie
    const effectivePower = powerInput * terrainLie.powerFactor;
    const totalDistance = club.maxDistance * effectivePower;

    // 2. Calculate Final Shot Angle (aim + intentional shape + snap error + overswing penalty + slope)
    const overswingDrift = (Math.random() - 0.5) * overswingPenalty * 0.14;
    const slopeAngleOffset = (slope.x * 0.05);

    // Total Angle calculation:
    // Early click / snapError < 0 -> Hook (left curvature)
    // Late click / snapError > 0 -> Slice (right curvature)
    const totalAngle = aimAngle + intentionalShape + (snapError * 0.28) + overswingDrift + slopeAngleOffset;

    if (club.isPutter) {
      // Ground Putting roll
      const putterSpeed = (effectivePower * club.maxDistance * 0.12);
      this.vx = Math.cos(totalAngle) * putterSpeed;
      this.vy = Math.sin(totalAngle) * putterSpeed;
      this.vz = 0;
      this.inAir = false;
      this.isRolling = true;
    } else {
      // 3D Loft Flight Trajectory
      const launchSpeed = Math.sqrt(totalDistance) * 0.72;
      const effectiveLoft = club.loft * (terrainLie.loftFactor || 1.0);
      const loftRad = (effectiveLoft * Math.PI) / 180;

      this.vx = Math.cos(totalAngle) * launchSpeed * Math.cos(loftRad);
      this.vy = Math.sin(totalAngle) * launchSpeed * Math.cos(loftRad);
      this.vz = Math.sin(loftRad) * launchSpeed * 1.35;

      this.inAir = true;
      this.isRolling = false;
    }

    this.trail = [];
    this.isHoled = false;
    this.inHazard = false;
    this.inOB = false;
  }

  update(terrainPixelSampleCallback, wind = { speed: 0, dirAngle: 0 }, audioEngine = null) {
    if (this.isHoled || (!this.inAir && !this.isRolling && Math.hypot(this.vx, this.vy) < 0.05)) {
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      this.isRolling = false;
      return;
    }

    // Record trail positions
    if (this.inAir && Math.random() < 0.35) {
      this.trail.push({ x: this.x, y: this.y, z: this.z });
      if (this.trail.length > 30) this.trail.shift();
    }

    if (this.inAir) {
      // Apply Air Drag
      this.vx *= this.airDrag;
      this.vy *= this.airDrag;

      // Apply Wind Drift to 2D trajectory
      const windRad = (wind.dirAngle * Math.PI) / 180;
      const windForceX = Math.cos(windRad) * wind.speed * 0.004;
      const windForceY = Math.sin(windRad) * wind.speed * 0.004;
      this.vx += windForceX;
      this.vy += windForceY;

      // Apply Gravity to vertical altitude
      this.vz -= this.gravity;

      // Update 3D Coordinates
      this.x += this.vx;
      this.y += this.vy;
      this.z += this.vz;

      // Ground Impact Detection & Terrain Response
      if (this.z <= 0) {
        this.z = 0;

        // Sample Terrain Surface at Ground Contact
        if (terrainPixelSampleCallback) {
          const color = terrainPixelSampleCallback(this.x, this.y);
          this.currentTerrain = identifyTerrainFromColor(color.r, color.g, color.b, color.a);
        }

        // Check for Water Hazard
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

        // Check for Out of Bounds
        if (this.currentTerrain.isOB) {
          this.inAir = false;
          this.isRolling = false;
          this.inOB = true;
          this.vx = 0;
          this.vy = 0;
          this.vz = 0;
          return;
        }

        // Calculate Terrain Response (Restitution Bounce)
        const bounceVz = -this.vz * this.currentTerrain.restitution;

        if (bounceVz > 1.2) {
          this.vz = bounceVz;
          this.vx *= this.currentTerrain.friction;
          this.vy *= this.currentTerrain.friction;
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

      if (this.currentTerrain.isOB) {
        this.isRolling = false;
        this.inOB = true;
        this.vx = 0;
        this.vy = 0;
        return;
      }

      // Apply Terrain Surface Friction
      this.vx *= this.currentTerrain.friction;
      this.vy *= this.currentTerrain.friction;

      this.x += this.vx;
      this.y += this.vy;

      if (Math.hypot(this.vx, this.vy) < 0.08) {
        this.vx = 0;
        this.vy = 0;
        this.isRolling = false;
      }
    }
  }

  render(ctx) {
    if (this.isHoled) return;

    // 1. Render Flight Trail Dots
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

    // 2. Render Ball Shadow
    const shadowX = this.x + (this.z * 0.45);
    const shadowY = this.y - (this.z * 0.6);
    const shadowScale = Math.max(0.4, 1 - (this.z / 120));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, this.radius * shadowScale * 1.3, this.radius * shadowScale * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Render Golf Ball
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
