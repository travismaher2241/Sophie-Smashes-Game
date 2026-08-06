/**
 * 2D Top-Down Camera with Smart Target Framing, Smooth Zoom Transitions & Full Map Overview Mode
 */
export class Camera {
  constructor(viewportWidth = 960, viewportHeight = 640) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    
    this.targetX = 0;
    this.targetY = 0;
    
    this.mapWidth = 724;
    this.mapHeight = 2172;
    
    this.zoom = 0.75;
    this.targetZoom = 0.75;
    this.smoothness = 0.09;
    
    this.isFullOverview = false;
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
    if (this.isFullOverview) return;
    this.targetX = x;
    this.targetY = y;
    if (desiredZoom !== null) {
      this.targetZoom = desiredZoom;
    }
  }

  /**
   * Smart Framing: Positions camera to view BOTH Player and Landing Target simultaneously
   */
  setAimTarget(playerX, playerY, landingX, landingY) {
    if (this.isFullOverview) return;

    // Midpoint between player and landing target
    this.targetX = (playerX + landingX) / 2;
    this.targetY = (playerY + landingY) / 2;

    // Calculate distance between player and target to adjust zoom scale
    const dist = Math.hypot(landingX - playerX, landingY - playerY);
    // Scale zoom so both points comfortably fit inside viewport
    const fitZoom = Math.min(0.9, Math.max(0.42, (this.viewportHeight * 0.7) / (dist + 120)));
    this.targetZoom = fitZoom;
  }

  toggleFullOverview() {
    this.isFullOverview = !this.isFullOverview;
    if (this.isFullOverview) {
      // Center of whole course map
      this.targetX = this.mapWidth / 2;
      this.targetY = this.mapHeight / 2;
      // Zoom out to show entire 724x2172 map
      this.targetZoom = Math.min(this.viewportWidth / this.mapWidth, this.viewportHeight / this.mapHeight);
    }
    return this.isFullOverview;
  }

  jumpTo(x, y, zoom = 0.75) {
    this.targetX = x;
    this.targetY = y;
    this.zoom = zoom;
    this.targetZoom = zoom;
    this.x = x - (this.viewportWidth / (2 * this.zoom));
    this.y = y - (this.viewportHeight / (2 * this.zoom));
    this.clamp();
  }

  update() {
    // Smooth Zoom interpolation
    this.zoom += (this.targetZoom - this.zoom) * 0.08;

    const idealX = this.targetX - (this.viewportWidth / (2 * this.zoom));
    const idealY = this.targetY - (this.viewportHeight / (2 * this.zoom));

    this.x += (idealX - this.x) * this.smoothness;
    this.y += (idealY - this.y) * this.smoothness;

    this.clamp();
  }

  clamp() {
    const visibleW = this.viewportWidth / this.zoom;
    const visibleH = this.viewportHeight / this.zoom;

    const maxCameraX = Math.max(0, this.mapWidth - visibleW);
    const maxCameraY = Math.max(0, this.mapHeight - visibleH);

    this.x = Math.max(0, Math.min(this.x, maxCameraX));
    this.y = Math.max(0, Math.min(this.y, maxCameraY));
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
