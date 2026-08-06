/**
 * 16-Bit Golf Terrain Surface Types, Physical Lie & Ball Response Properties
 */
export const TERRAIN_TYPES = {
  TEE_BOX: {
    id: 'TEE_BOX',
    name: 'Tee Box',
    restitution: 0.55, // Bounce elasticity
    friction: 0.88,    // Ground roll friction
    drag: 1.0,
    lie: { powerFactor: 1.0, loftFactor: 1.0, description: '100% Perfect Tee Lie' },
    hexColor: '#388e3c'
  },
  FAIRWAY: {
    id: 'FAIRWAY',
    name: 'Fairway',
    restitution: 0.50,
    friction: 0.85,
    drag: 1.0,
    lie: { powerFactor: 1.0, loftFactor: 1.0, description: '100% Clean Fairway Lie' },
    hexColor: '#2e7d32'
  },
  ROUGH: {
    id: 'ROUGH',
    name: 'Rough',
    restitution: 0.25,
    friction: 0.55,
    drag: 0.70,
    lie: { powerFactor: 0.75, loftFactor: 1.18, description: '75% Deep Grass Lie' },
    hexColor: '#1b5e20'
  },
  BUNKER: {
    id: 'BUNKER',
    name: 'Sand Bunker',
    restitution: 0.10,
    friction: 0.30,
    drag: 0.50,
    lie: { powerFactor: 0.45, loftFactor: 1.35, description: '45% Sand Trap Lie' },
    hexColor: '#fbc02d'
  },
  GREEN: {
    id: 'GREEN',
    name: 'Putting Green',
    restitution: 0.60,
    friction: 0.94,
    drag: 1.0,
    lie: { powerFactor: 1.0, loftFactor: 1.0, description: 'Smooth Green Lie' },
    hexColor: '#00e676'
  },
  WATER: {
    id: 'WATER',
    name: 'Water Hazard',
    restitution: 0.0,
    friction: 0.0,
    drag: 0.0,
    isHazard: true,
    lie: { powerFactor: 0.0, loftFactor: 0.0, description: 'Submerged Water Hazard' },
    hexColor: '#0288d1'
  },
  OUT_OF_BOUNDS: {
    id: 'OUT_OF_BOUNDS',
    name: 'Out of Bounds',
    restitution: 0.0,
    friction: 0.0,
    drag: 0.0,
    isOB: true,
    lie: { powerFactor: 0.0, loftFactor: 0.0, description: 'Out of Bounds' },
    hexColor: '#000000'
  }
};

/**
 * Determine terrain type from RGBA pixel data
 */
export function identifyTerrainFromColor(r, g, b, a) {
  if (a < 50 || (r < 15 && g < 15 && b < 15)) {
    return TERRAIN_TYPES.OUT_OF_BOUNDS;
  }
  if (b > r + 30 && b > g - 20) {
    return TERRAIN_TYPES.WATER;
  }
  if (r > 180 && g > 150 && b < 130) {
    return TERRAIN_TYPES.BUNKER;
  }
  if (g > 190 && r < 120) {
    return TERRAIN_TYPES.GREEN;
  }
  if (g > 100) {
    if (r > 40 && g > 130) {
      return TERRAIN_TYPES.FAIRWAY;
    }
    return TERRAIN_TYPES.ROUGH;
  }
  return TERRAIN_TYPES.FAIRWAY;
}
