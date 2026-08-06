import { generateSophieSpriteSheet, generateProceduralHoleMap } from '../utils/PixelArtGen.js';

/**
 * 16-Bit Asset Pipeline & Asset Loader
 * Resolves relative URLs for static deployment on Vercel
 * and supplies pristine procedural 16-bit fallbacks.
 */
export class AssetLoader {
  constructor() {
    this.holeMaps = new Map();
    this.holeMetadata = new Map();
    this.sophieSpriteSheet = null;
    this.spriteMetadata = null;
    this.loaded = false;
  }

  async loadAllAssets() {
    // 1. Load Sophie Player Sprite Sheet
    const spriteUrls = [
      './assets/sprites/spritesheet.png',
      './assets/sprites/sophie_swing.png',
      './assets/spritesheet.png',
      './assets/sophie_swing.png'
    ];

    for (const url of spriteUrls) {
      try {
        const img = await this.loadImage(url);
        this.sophieSpriteSheet = img;
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        if (w >= 4000) {
          // 4x2 Grid (4344 x 2896)
          this.spriteMetadata = {
            cols: 4,
            rows: 2,
            frameWidth: Math.round(w / 4),
            frameHeight: Math.round(h / 2),
            totalFrames: 8,
            renderSize: 64
          };
        } else {
          // Standard horizontal 8-frame sheet
          this.spriteMetadata = {
            cols: 8,
            rows: 1,
            frameWidth: Math.round(w / 8),
            frameHeight: h,
            totalFrames: 8,
            renderSize: 48
          };
        }
        console.log(`Loaded custom player sprite sheet from ${url}`);
        break;
      } catch {
        // Try next URL
      }
    }

    if (!this.sophieSpriteSheet) {
      console.log('Using procedural 16-bit Sophie sprite sheet fallback.');
      this.sophieSpriteSheet = generateSophieSpriteSheet();
      this.spriteMetadata = {
        cols: 8,
        rows: 1,
        frameWidth: 48,
        frameHeight: 48,
        totalFrames: 8,
        renderSize: 48
      };
    }

    // 2. Load 9 Pre-rendered Hole Maps (724x2172)
    for (let h = 1; h <= 9; h++) {
      let img = null;
      try {
        img = await this.loadImage(`./assets/hole${h}.png`);
      } catch {
        try {
          img = await this.loadImage(`./assets/maps/hole${h}.png`);
        } catch {
          console.log(`Using procedural map for Hole ${h}`);
        }
      }

      if (img) {
        this.holeMaps.set(h, img);
        const w = img.naturalWidth || img.width || 724;
        const hPx = img.naturalHeight || img.height || 2172;

        const parMap = { 1: 4, 2: 4, 3: 3, 4: 5, 5: 4, 6: 5, 7: 3, 8: 4, 9: 4 };
        const nameMap = {
          1: 'Pine Valley',
          2: 'Dogleg Ridge',
          3: 'Island Green',
          4: 'Sand Canyon',
          5: 'Creek Crossing',
          6: 'Monster Par 5',
          7: 'Cliffside Drop',
          8: 'Twin Bunkers',
          9: 'Championship Finish'
        };

        this.holeMetadata.set(h, {
          hole: h,
          name: nameMap[h] || `Hole ${h}`,
          par: parMap[h] || 4,
          teePos: { x: Math.round(w / 2), y: Math.round(hPx * 0.925) },
          pinPos: { x: Math.round(w / 2), y: Math.round(hPx * 0.08) },
          width: w,
          height: hPx
        });
      } else {
        // Fallback procedural map
        const procMap = generateProceduralHoleMap(h);
        this.holeMaps.set(h, procMap.canvas);
        this.holeMetadata.set(h, procMap.metadata);
      }
    }

    this.loaded = true;
    return true;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load asset at ${url}`));
      img.src = url;
    });
  }

  getHoleMap(holeNum) {
    return this.holeMaps.get(holeNum) || this.holeMaps.get(1);
  }

  getHoleMetadata(holeNum) {
    if (this.holeMetadata.has(holeNum)) {
      return this.holeMetadata.get(holeNum);
    }
    const mapCanvas = this.getHoleMap(holeNum);
    const w = mapCanvas.width || 724;
    const h = mapCanvas.height || 2172;
    return {
      hole: holeNum,
      name: `Hole ${holeNum}`,
      par: 4,
      teePos: { x: Math.round(w / 2), y: Math.round(h * 0.925) },
      pinPos: { x: Math.round(w / 2), y: Math.round(h * 0.08) },
      width: w,
      height: h
    };
  }

  getSophieSpriteSheet() {
    return this.sophieSpriteSheet;
  }

  getSpriteMetadata() {
    return this.spriteMetadata || {
      cols: 8,
      rows: 1,
      frameWidth: 48,
      frameHeight: 48,
      totalFrames: 8,
      renderSize: 48
    };
  }
}
