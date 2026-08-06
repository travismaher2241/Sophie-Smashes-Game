/**
 * 2D Top-Down Camera with Smart Target Framing, Mobile Centering & Touch Panning
 */
export class Camera {
  constructor(viewportWidth = 960, viewportHeight = 720) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    
    this.targetX = 362;
    this.targetY = 2000;
    
    this.mapWidth = 724;
    this.mapHeight = 2172;
    
    this.zoom = 0.85;
    this.targetZoom = 0.85;
    this.smoothness = 0.12;
    
    this.isFullOverview = false;
    this.isManualPanning = false;
  }

  setViewportSize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  setMapBounds(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  setTarget(x, y, desiredZoom = null) {
    if (this.isFullOverview || this.isManualPanning) return;
    this.targetX = x;
    this.targetY = y;
    if (desiredZoom !== null) {
      this.targetZoom = desiredZoom;
    }
  }

  /**
   * Smart Framing: Positions camera to center on player tee box & target area
   */
  setAimTarget(playerX, playerY, landingX, landingY) {
    if (this.isFullOverview || this.isManualPanning) return;

    // Midpoint between player and landing target
    this.targetX = (playerX + landingX) / 2;
    this.targetY = (playerY + landingY) / 2;

    const dist = Math.hypot(landingX - playerX, landingY - playerY);
    // Fit zoom scale so both points fit nicely
    const fitZoom = Math.min(0.95, Math.max(0.55, (this.viewportHeight * 0.7) / (dist + 160)));
    this.targetZoom = fitZoom;
  }

  toggleFullOverview() {
    this.isFullOverview = !this.isFullOverview;
    this.isManualPanning = false;

    if (this.isFullOverview) {
      this.targetX = this.mapWidth / 2;
      this.targetY = this.mapHeight / 2;
      this.targetZoom = Math.min(this.viewportWidth / this.mapWidth, this.viewportHeight / this.mapHeight);
    }
    return this.isFullOverview;
  }

  jumpTo(x, y, zoom = 0.85) {
    this.targetX = x;
    this.targetY = y;
    this.zoom = zoom;
    this.targetZoom = zoom;
    this.isManualPanning = false;
    this.x = x - (this.viewportWidth / (2 * this.zoom));
    this.y = y - (this.viewportHeight / (2 * this.zoom));
    this.clamp();
  }

  panBy(deltaX, deltaY) {
    this.isManualPanning = true;
    this.x -= deltaX / this.zoom;
    this.y -= deltaY / this.zoom;
    this.clamp();
  }

  update() {
    // Smooth Zoom interpolation
    this.zoom += (this.targetZoom - this.zoom) * 0.10;

    if (!this.isManualPanning) {
      const idealX = this.targetX - (this.viewportWidth / (2 * this.zoom));
      const idealY = this.targetY - (this.viewportHeight / (2 * this.zoom));

      this.x += (idealX - this.x) * this.smoothness;
      this.y += (idealY - this.y) * this.smoothness;
    }

    this.clamp();
  }

  clamp() {
    const visibleW = this.viewportWidth / this.zoom;
    const visibleH = this.viewportHeight / this.zoom;

    // Mobile & Responsive Centering Logic
    if (visibleW >= this.mapWidth) {
      // Map is narrower than viewport -> Center map horizontally!
      this.x = -(visibleW - this.mapWidth) / 2;
    } else {
      const maxCameraX = this.mapWidth - visibleW;
      this.x = Math.max(0, Math.min(this.x, maxCameraX));
    }

    if (visibleH >= this.mapHeight) {
      // Map is shorter than viewport -> Center map vertically!
      this.y = -(visibleH - this.mapHeight) / 2;
    } else {
      const maxCameraY = this.mapHeight - visibleH;
      this.y = Math.max(0, Math.min(this.y, maxCameraY));
    }
  }

  applyTransform(ctx) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.floor(this.x), -Math.floor(this.y));
  }

  restoreTransform(ctx) {
    ctx.restore();
  }
}
