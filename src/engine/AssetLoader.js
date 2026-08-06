import { generateSophieSpriteSheet, generateProceduralHoleMap } from '../utils/PixelArtGen.js';

/**
 * 16-Bit Asset Pipeline & Asset Loader
 * Configured for Warragul Country Club Holes 1 to 9
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
          this.spriteMetadata = {
            cols: 4,
            rows: 2,
            frameWidth: Math.round(w / 4),
            frameHeight: Math.round(h / 2),
            totalFrames: 8,
            renderSize: 64
          };
        } else {
          this.spriteMetadata = {
            cols: 8,
            rows: 1,
            frameWidth: Math.round(w / 8),
            frameHeight: h,
            totalFrames: 8,
            renderSize: 48
          };
        }
        break;
      } catch {}
    }

    if (!this.sophieSpriteSheet) {
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

    // Official Warragul Country Club Hole Data (Meters & Par)
    const warragulHoles = {
      1: { name: 'Warragul Country Club - Hole 1', par: 4, meters: 307 },
      2: { name: 'Warragul Country Club - Hole 2', par: 4, meters: 334 },
      3: { name: 'Warragul Country Club - Hole 3', par: 4, meters: 345 },
      4: { name: 'Warragul Country Club - Hole 4', par: 4, meters: 265 },
      5: { name: 'Warragul Country Club - Hole 5', par: 4, meters: 305 },
      6: { name: 'Warragul Country Club - Hole 6', par: 4, meters: 240 },
      7: { name: 'Warragul Country Club - Hole 7', par: 3, meters: 175 },
      8: { name: 'Warragul Country Club - Hole 8', par: 5, meters: 429 },
      9: { name: 'Warragul Country Club - Hole 9', par: 4, meters: 289 }
    };

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

      const holeData = warragulHoles[h];

      if (img) {
        this.holeMaps.set(h, img);
        const w = img.naturalWidth || img.width || 724;
        const hPx = img.naturalHeight || img.height || 2172;

        this.holeMetadata.set(h, {
          hole: h,
          name: holeData.name,
          par: holeData.par,
          meters: holeData.meters,
          teePos: { x: Math.round(w / 2), y: Math.round(hPx * 0.925) },
          pinPos: { x: Math.round(w / 2), y: Math.round(hPx * 0.08) },
          width: w,
          height: hPx
        });
      } else {
        const procMap = generateProceduralHoleMap(h);
        this.holeMaps.set(h, procMap.canvas);
        this.holeMetadata.set(h, {
          ...procMap.metadata,
          name: holeData.name,
          par: holeData.par,
          meters: holeData.meters
        });
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
    return this.holeMetadata.get(holeNum) || {
      hole: holeNum,
      name: `Warragul Country Club - Hole ${holeNum}`,
      par: 4,
      meters: 300,
      teePos: { x: 362, y: 2009 },
      pinPos: { x: 362, y: 174 },
      width: 724,
      height: 2172
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
