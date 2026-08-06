import { TERRAIN_TYPES, identifyTerrainFromColor } from '../utils/TerrainTypes.js';

/**
 * 3D Top-Down Golf Ball Physics Engine
 * Simulates 3D trajectory (x, y, z) with gravity, wind drift,
 * shadow offset, terrain restitution bounce, and surface friction roll.
 */
export class BallPhysics {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.z = 0; // Altitude off ground

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.radius = 3;
    this.inAir = false;
    this.isRolling = false;
    this.isHoled = false;
    this.inHazard = false;

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
    this.trail = [];
  }

  /**
   * Launch Ball with Shot Vector
   */
  launch(power, angle, club, snapOffset = 0, wind = { x: 0, y: 0 }) {
    if (club.isPutter) {
      // Ground putting roll
      const putterSpeed = (power * club.maxDistance * 0.12);
      const totalAngle = angle + (snapOffset * 0.15);
      this.vx = Math.cos(totalAngle) * putterSpeed;
      this.vy = Math.sin(totalAngle) * putterSpeed;
      this.vz = 0;
      this.inAir = false;
      this.isRolling = true;
    } else {
      // 3D Loft Flight Trajectory
      const totalDistance = club.maxDistance * power;
      const totalAngle = angle + (snapOffset * 0.28); // Hook / Slice curvature

      // Initial velocities
      const launchSpeed = Math.sqrt(totalDistance) * 0.72;
      const loftRad = (club.loft * Math.PI) / 180;

      this.vx = Math.cos(totalAngle) * launchSpeed * Math.cos(loftRad);
      this.vy = Math.sin(totalAngle) * launchSpeed * Math.cos(loftRad);
      this.vz = Math.sin(loftRad) * launchSpeed * 1.35;

      this.inAir = true;
      this.isRolling = false;
    }

    this.trail = [];
    this.isHoled = false;
    this.inHazard = false;
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
    if (this.inAir && Math.random() < 0.3) {
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

      // Ground Impact Detection
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

        // Calculate Restitution Bounce
        const bounceVz = -this.vz * this.currentTerrain.restitution;

        if (bounceVz > 1.2) {
          // Bounce off ground back into air
          this.vz = bounceVz;
          this.vx *= this.currentTerrain.friction;
          this.vy *= this.currentTerrain.friction;
          if (audioEngine) audioEngine.playBounce(Math.min(0.5, bounceVz / 8));
        } else {
          // Transition from Air Flight to Ground Roll
          this.vz = 0;
          this.inAir = false;
          this.isRolling = true;
          if (audioEngine) audioEngine.playBounce(0.15);
        }
      }
    } else if (this.isRolling) {
      // Sample ground terrain continuously while rolling
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

      // Apply Ground Surface Friction
      this.vx *= this.currentTerrain.friction;
      this.vy *= this.currentTerrain.friction;

      this.x += this.vx;
      this.y += this.vy;

      // Stopped rolling
      if (Math.hypot(this.vx, this.vy) < 0.08) {
        this.vx = 0;
        this.vy = 0;
        this.isRolling = false;
      }
    }
  }

  render(ctx) {
    if (this.isHoled) return; // Hidden inside cup

    // 1. Render Flight Trail Dots
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // 2. Render Ball Shadow (Offset based on height Z)
    const shadowX = this.x + (this.z * 0.45);
    const shadowY = this.y - (this.z * 0.6);
    const shadowScale = Math.max(0.4, 1 - (this.z / 120));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, this.radius * shadowScale * 1.2, this.radius * shadowScale * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Render Golf Ball (Scales slightly with altitude Z)
    const ballScale = 1 + (this.z / 90);
    const renderY = this.y - this.z;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, renderY, this.radius * ballScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}
