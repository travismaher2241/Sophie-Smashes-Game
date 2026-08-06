import { TERRAIN_TYPES } from '../utils/TerrainTypes.js';

/**
 * Scene Manager & 16-Bit Map Handler
 * Manages Hole 1 through 9, terrain pixel sampling, and score tracking.
 */
export class SceneManager {
  constructor(assetLoader) {
    this.assetLoader = assetLoader;
    this.currentHoleIndex = 1;
    this.currentMapCanvas = null;
    this.currentMetadata = null;

    // Offscreen Canvas for Fast Pixel Sampling
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

    // Scorecard tracking (Holes 1 to 9)
    this.scores = Array(10).fill(0);
    this.totalStrokes = 0;
    this.currentHoleStrokes = 0;
  }

  loadHole(holeNum) {
    this.currentHoleIndex = holeNum;
    this.currentMapCanvas = this.assetLoader.getHoleMap(holeNum);
    this.currentMetadata = this.assetLoader.getHoleMetadata(holeNum);

    // Update Offscreen Sample Canvas
    this.sampleCanvas.width = this.currentMapCanvas.width || 1280;
    this.sampleCanvas.height = this.currentMapCanvas.height || 960;
    this.sampleCtx.drawImage(this.currentMapCanvas, 0, 0);

    this.currentHoleStrokes = 0;
    return this.currentMetadata;
  }

  getTeePosition() {
    return this.currentMetadata ? this.currentMetadata.teePos : { x: 640, y: 800 };
  }

  getPinPosition() {
    return this.currentMetadata ? this.currentMetadata.pinPos : { x: 640, y: 200 };
  }

  /**
   * Fast Pixel Sampling for Terrain Surface Identification
   */
  sampleTerrainPixel(x, y) {
    const px = Math.floor(x);
    const py = Math.floor(y);

    if (px < 0 || py < 0 || px >= this.sampleCanvas.width || py >= this.sampleCanvas.height) {
      return { r: 0, g: 0, b: 0, a: 0 }; // Out of Bounds (Black)
    }

    try {
      const data = this.sampleCtx.getImageData(px, py, 1, 1).data;
      return { r: data[0], g: data[1], b: data[2], a: data[3] };
    } catch {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
  }

  calculateDistanceToPinInYards(ballX, ballY) {
    const pin = this.getPinPosition();
    const pixelDist = Math.hypot(pin.x - ballX, pin.y - ballY);
    // Scale: ~2.2 pixels per yard
    return Math.round(pixelDist / 2.2);
  }

  recordStroke() {
    this.currentHoleStrokes++;
    this.totalStrokes++;
    this.scores[this.currentHoleIndex] = this.currentHoleStrokes;
  }

  getScoreSummary() {
    let totalPar = 0;
    let strokes = 0;

    for (let h = 1; h <= 9; h++) {
      const meta = this.assetLoader.getHoleMetadata(h);
      if (this.scores[h] > 0) {
        totalPar += meta.par;
        strokes += this.scores[h];
      }
    }

    const diff = strokes - totalPar;
    if (strokes === 0) return 'EVEN';
    if (diff === 0) return 'EVEN';
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
  }

  renderMap(ctx) {
    if (this.currentMapCanvas) {
      ctx.drawImage(this.currentMapCanvas, 0, 0);
    }
  }
}
