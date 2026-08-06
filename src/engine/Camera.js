/**
 * 2D Top-Down Camera with Smooth Target Tracking & Boundary Clamping
 */
export class Camera {
  constructor(viewportWidth = 640, viewportHeight = 480) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.targetX = 0;
    this.targetY = 0;
    this.mapWidth = 1280;
    this.mapHeight = 960;
    this.zoom = 1.0;
    this.smoothness = 0.08; // Interpolation factor
  }

  setMapBounds(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  jumpTo(x, y) {
    this.targetX = x;
    this.targetY = y;
    this.x = x - (this.viewportWidth / (2 * this.zoom));
    this.y = y - (this.viewportHeight / (2 * this.zoom));
    this.clamp();
  }

  update() {
    const idealX = this.targetX - (this.viewportWidth / (2 * this.zoom));
    const idealY = this.targetY - (this.viewportHeight / (2 * this.zoom));

    this.x += (idealX - this.x) * this.smoothness;
    this.y += (idealY - this.y) * this.smoothness;

    this.clamp();
  }

  clamp() {
    const maxCameraX = Math.max(0, this.mapWidth - (this.viewportWidth / this.zoom));
    const maxCameraY = Math.max(0, this.mapHeight - (this.viewportHeight / this.zoom));

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
