/**
 * 16-Bit Golf Club Specifications & Shot Types (Full 14-Club Bag + Putter)
 * Includes Smart Caddie Auto-Club Recommendation System
 */

export const SHOT_TYPES = [
  {
    id: 'FULL',
    name: 'FULL SHOT',
    distMult: 1.0,
    loftMult: 1.0,
    rollMult: 1.0,
    description: 'Standard full trajectory shot.'
  },
  {
    id: 'PITCH',
    name: 'PITCH SHOT',
    distMult: 0.55,
    loftMult: 1.35,
    rollMult: 0.25,
    description: 'High arc, soft landing with minimal roll.'
  },
  {
    id: 'CHIP',
    name: 'CHIP SHOT',
    distMult: 0.35,
    loftMult: 0.50,
    rollMult: 0.60,
    description: 'Low bump-and-run shot with controlled ground roll.'
  },
  {
    id: 'FLOP',
    name: 'FLOP SHOT',
    distMult: 0.25,
    loftMult: 1.60,
    rollMult: 0.05,
    description: 'Ultra-high vertical flop landing dead on green.'
  }
];

export const CLUBS = [
  { id: 'DRIVER',   name: 'DRIVER (1D)',    maxDistance: 220, loft: 10, rollFactor: 1.2  },
  { id: '3WOOD',    name: '3-WOOD (3W)',   maxDistance: 195, loft: 15, rollFactor: 1.1  },
  { id: '5WOOD',    name: '5-WOOD (5W)',   maxDistance: 180, loft: 18, rollFactor: 1.05 },
  { id: '3HYBRID',  name: '3-HYBRID (3H)', maxDistance: 170, loft: 21, rollFactor: 1.0  },
  { id: '4IRON',    name: '4-IRON (4I)',   maxDistance: 160, loft: 24, rollFactor: 0.95 },
  { id: '5IRON',    name: '5-IRON (5I)',   maxDistance: 150, loft: 27, rollFactor: 0.90 },
  { id: '6IRON',    name: '6-IRON (6I)',   maxDistance: 140, loft: 30, rollFactor: 0.85 },
  { id: '7IRON',    name: '7-IRON (7I)',   maxDistance: 130, loft: 33, rollFactor: 0.80 },
  { id: '8IRON',    name: '8-IRON (8I)',   maxDistance: 120, loft: 37, rollFactor: 0.70 },
  { id: '9IRON',    name: '9-IRON (9I)',   maxDistance: 105, loft: 41, rollFactor: 0.60 },
  { id: 'PWEDGE',   name: 'PITCH WEDGE (PW)', maxDistance: 85, loft: 45, rollFactor: 0.45 },
  { id: 'GWEDGE',   name: 'GAP WEDGE (GW)',   maxDistance: 70, loft: 50, rollFactor: 0.35 },
  { id: 'SWEDGE',   name: 'SAND WEDGE (SW)',  maxDistance: 50, loft: 54, rollFactor: 0.25 },
  { id: 'LWEDGE',   name: 'LOB WEDGE (LW)',   maxDistance: 35, loft: 58, rollFactor: 0.10 },
  { id: 'PUTTER',   name: 'PUTTER (PT)',      maxDistance: 15, loft: 0,  rollFactor: 1.5, isPutter: true }
];

export class ClubManager {
  constructor() {
    this.clubs = CLUBS;
    this.currentClubIndex = 0; // Starts with Driver
    this.shotTypes = SHOT_TYPES;
    this.currentShotTypeIndex = 0; // Starts with FULL
  }

  getCurrentClub() {
    return this.clubs[this.currentClubIndex];
  }

  getCurrentShotType() {
    return this.shotTypes[this.currentShotTypeIndex];
  }

  nextClub() {
    this.currentClubIndex = (this.currentClubIndex + 1) % this.clubs.length;
    return this.getCurrentClub();
  }

  prevClub() {
    this.currentClubIndex = (this.currentClubIndex - 1 + this.clubs.length) % this.clubs.length;
    return this.getCurrentClub();
  }

  selectClubById(id) {
    const idx = this.clubs.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.currentClubIndex = idx;
    }
    return this.getCurrentClub();
  }

  nextShotType() {
    this.currentShotTypeIndex = (this.currentShotTypeIndex + 1) % this.shotTypes.length;
    return this.getCurrentShotType();
  }

  prevShotType() {
    this.currentShotTypeIndex = (this.currentShotTypeIndex - 1 + this.shotTypes.length) % this.shotTypes.length;
    return this.getCurrentShotType();
  }

  selectShotTypeById(id) {
    const idx = SHOT_TYPES.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.currentShotTypeIndex = idx;
    }
    return this.getCurrentShotType();
  }

  getEffectiveDistance() {
    const club = this.getCurrentClub();
    const shotType = this.getCurrentShotType();
    if (club.isPutter) return 15;

    let maxCap = club.maxDistance;
    let mult = 1.0;
    if (club.id === 'SWEDGE' && (shotType.id === 'PITCH' || shotType.id === 'CHIP')) {
      return 25; // Hard 25m cap for Sand Wedge Pitch/Chip
    }
    if (shotType.id === 'PITCH') {
      maxCap = Math.min(45, club.maxDistance);
      mult = 0.65;
    } else if (shotType.id === 'CHIP') {
      maxCap = Math.min(25, club.maxDistance);
      mult = 0.45;
    } else if (shotType.id === 'FLOP') {
      maxCap = Math.min(20, club.maxDistance);
      mult = 0.35;
    }
    return Math.round(maxCap * mult);
  }

  /**
   * Smart Caddie Recommender:
   * Auto-selects the optimal club and shot mode based on distance to pin & terrain lie!
   */
  autoSelectBestClub(distanceToPinMeters, terrainType = null) {
    const liePowerFactor = (terrainType && terrainType.lie) ? terrainType.lie.powerFactor : 1.0;

    // 1. If ball is on Putting Green -> Auto Select Putter & Full Shot
    if (terrainType && terrainType.id === 'GREEN') {
      this.selectClubById('PUTTER');
      this.selectShotTypeById('FULL');
      return { club: this.getCurrentClub(), shotType: this.getCurrentShotType() };
    }

    // 2. Adjust target distance for terrain power loss (e.g. Rough = 75%, Sand = 45%)
    const targetCarryMeters = distanceToPinMeters / Math.max(0.40, liePowerFactor);

    // 3. Short Approach / Green Fringe (Under 35m)
    if (distanceToPinMeters <= 35) {
      if (distanceToPinMeters <= 18) {
        this.selectClubById('LWEDGE');
        this.selectShotTypeById('CHIP');
      } else {
        this.selectClubById('SWEDGE');
        this.selectShotTypeById('PITCH');
      }
      return { club: this.getCurrentClub(), shotType: this.getCurrentShotType() };
    }

    // 4. Default to FULL SHOT for normal fairway/approach shots
    this.selectShotTypeById('FULL');

    // 5. Find the non-putter club whose max distance BEST matches targetCarryMeters
    const playableClubs = CLUBS.filter(c => !c.isPutter);
    
    let bestClub = playableClubs[0];
    let smallestDiff = Math.abs(playableClubs[0].maxDistance - targetCarryMeters);

    for (let i = 1; i < playableClubs.length; i++) {
      const club = playableClubs[i];
      const diff = Math.abs(club.maxDistance - targetCarryMeters);
      // Prefer club that reaches or slightly exceeds distance rather than coming up short
      if (diff < smallestDiff || (diff === smallestDiff && club.maxDistance >= targetCarryMeters)) {
        smallestDiff = diff;
        bestClub = club;
      }
    }

    this.selectClubById(bestClub.id);
    return { club: this.getCurrentClub(), shotType: this.getCurrentShotType() };
  }
}
