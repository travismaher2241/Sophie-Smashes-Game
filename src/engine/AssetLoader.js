import { generateSophieSpriteSheet, generateProceduralHoleMap } from '../utils/PixelArtGen.js';

/**
 * 16-Bit Asset Pipeline & Asset Loader
 * Explicit Tee-Box & Pin-Flag Map Coordinates for Warragul Country Club
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
          // 4x2 Grid (4344 x 2896) -> Scale up render size for prominent arcade character view!
          this.spriteMetadata = {
            cols: 4,
            rows: 2,
            frameWidth: Math.round(w / 4),
            frameHeight: Math.round(h / 2),
            totalFrames: 8,
            renderSize: 115 // Scaled up to look like a prominent arcade character
          };
        } else {
          // Standard horizontal 8-frame sheet
          this.spriteMetadata = {
            cols: 8,
            rows: 1,
            frameWidth: Math.round(w / 8),
            frameHeight: h,
            totalFrames: 8,
            renderSize: 96
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
        renderSize: 96
      };
    }

    // Explicit Tee-Box & Green Pin Coordinates for all 9 Warragul Country Club Hole Maps
    const warragulHoles = {
      1: { name: 'Warragul Country Club - Hole 1', par: 4, meters: 307, teePos: { x: 498, y: 1811 }, pinPos: { x: 285, y: 299 } },
      2: { name: 'Warragul Country Club - Hole 2', par: 4, meters: 334, teePos: { x: 430, y: 1791 }, pinPos: { x: 328, y: 308 } },
      3: { name: 'Warragul Country Club - Hole 3', par: 4, meters: 345, teePos: { x: 219, y: 1735 }, pinPos: { x: 479, y: 335 } },
      4: { name: 'Warragul Country Club - Hole 4', par: 4, meters: 265, teePos: { x: 185, y: 1804 }, pinPos: { x: 417, y: 310 } },
      5: { name: 'Warragul Country Club - Hole 5', par: 4, meters: 305, teePos: { x: 376, y: 1832 }, pinPos: { x: 373, y: 290 } },
      6: { name: 'Warragul Country Club - Hole 6', par: 4, meters: 240, teePos: { x: 351, y: 1766 }, pinPos: { x: 351, y: 309 } },
      7: { name: 'Warragul Country Club - Hole 7', par: 3, meters: 175, teePos: { x: 339, y: 1806 }, pinPos: { x: 385, y: 300 } },
      8: { name: 'Warragul Country Club - Hole 8', par: 5, meters: 429, teePos: { x: 526, y: 1754 }, pinPos: { x: 323, y: 300 } },
      9: { name: 'Warragul Country Club - Hole 9', par: 4, meters: 289, teePos: { x: 393, y: 1788 }, pinPos: { x: 295, y: 301 } }
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
          teePos: holeData.teePos,
          pinPos: holeData.pinPos,
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
          meters: holeData.meters,
          teePos: holeData.teePos,
          pinPos: holeData.pinPos
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
      teePos: { x: 362, y: 1800 },
      pinPos: { x: 362, y: 300 },
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
      renderSize: 115
    };
  }
}
