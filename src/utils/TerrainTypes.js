/**
 * 16-Bit Golf Terrain Surface Types and Physical Properties
 */
export const TERRAIN_TYPES = {
  TEE_BOX: {
    id: 'TEE_BOX',
    name: 'Tee Box',
    restitution: 0.55, // Bounce elasticity
    friction: 0.88,    // Ground roll friction (1.0 = no slowdown)
    drag: 1.0,         // Air drag multiplier
    hexColor: '#388e3c',
    description: 'Perfect tee off grass surface.'
  },
  FAIRWAY: {
    id: 'FAIRWAY',
    name: 'Fairway',
    restitution: 0.50,
    friction: 0.85,
    drag: 1.0,
    hexColor: '#2e7d32',
    description: 'Short cut grass, predictable bounce and roll.'
  },
  ROUGH: {
    id: 'ROUGH',
    name: 'Rough',
    restitution: 0.25,
    friction: 0.55,
    drag: 0.70,
    hexColor: '#1b5e20',
    description: 'Deep thick grass, deadens bounce and roll severely.'
  },
  BUNKER: {
    id: 'BUNKER',
    name: 'Sand Bunker',
    restitution: 0.10,
    friction: 0.30,
    drag: 0.50,
    hexColor: '#fbc02d',
    description: 'Soft sand trap, ball stops almost immediately.'
  },
  GREEN: {
    id: 'GREEN',
    name: 'Putting Green',
    restitution: 0.60,
    friction: 0.94,
    drag: 1.0,
    hexColor: '#00e676',
    description: 'Ultra smooth, fast putting surface.'
  },
  WATER: {
    id: 'WATER',
    name: 'Water Hazard',
    restitution: 0.0,
    friction: 0.0,
    drag: 0.0,
    hexColor: '#0288d1',
    isHazard: true,
    description: 'Splash! Penalty stroke and drop.'
  },
  OUT_OF_BOUNDS: {
    id: 'OUT_OF_BOUNDS',
    name: 'Out of Bounds',
    restitution: 0.0,
    friction: 0.0,
    drag: 0.0,
    hexColor: '#000000',
    isOB: true,
    description: 'Isolated black background out of bounds.'
  }
};

/**
 * Determine terrain type from RGBA pixel data
 */
export function identifyTerrainFromColor(r, g, b, a) {
  // If transparent or solid black background -> Out of Bounds
  if (a < 50 || (r < 15 && g < 15 && b < 15)) {
    return TERRAIN_TYPES.OUT_OF_BOUNDS;
  }

  // Water detection (Blue dominance)
  if (b > r + 30 && b > g - 20) {
    return TERRAIN_TYPES.WATER;
  }

  // Sand Bunker detection (Yellow / Gold / Warm Tan)
  if (r > 180 && g > 150 && b < 130) {
    return TERRAIN_TYPES.BUNKER;
  }

  // Green detection (Bright Neon Lime Green)
  if (g > 190 && r < 120) {
    return TERRAIN_TYPES.GREEN;
  }

  // Fairway vs Rough detection (Mid Green vs Dark Forest Green)
  if (g > 100) {
    if (r > 40 && g > 130) {
      return TERRAIN_TYPES.FAIRWAY;
    }
    return TERRAIN_TYPES.ROUGH;
  }

  // Fallback
  return TERRAIN_TYPES.FAIRWAY;
}
