/**
 * 16-Bit Golf Club Specifications & Trajectory Physics Models
 */
export const CLUBS = [
  {
    id: 'DRIVER',
    name: 'DRIVER (1D)',
    maxDistance: 240, // Yards
    loft: 10,        // Launch angle (degrees)
    maxHeight: 45,   // Peak 3D altitude
    rollFactor: 1.2  // Ground roll multiplier
  },
  {
    id: '3WOOD',
    name: '3-WOOD (3W)',
    maxDistance: 215,
    loft: 15,
    maxHeight: 48,
    rollFactor: 1.1
  },
  {
    id: '5IRON',
    name: '5-IRON (5I)',
    maxDistance: 180,
    loft: 22,
    maxHeight: 52,
    rollFactor: 0.95
  },
  {
    id: '7IRON',
    name: '7-IRON (7I)',
    maxDistance: 150,
    loft: 30,
    maxHeight: 56,
    rollFactor: 0.8
  },
  {
    id: 'PWEDGE',
    name: 'PITCH WEDGE (PW)',
    maxDistance: 110,
    loft: 42,
    maxHeight: 62,
    rollFactor: 0.5
  },
  {
    id: 'SWEDGE',
    name: 'SAND WEDGE (SW)',
    maxDistance: 80,
    loft: 54,
    maxHeight: 68,
    rollFactor: 0.3
  },
  {
    id: 'PUTTER',
    name: 'PUTTER (PT)',
    maxDistance: 40,
    loft: 0,
    maxHeight: 0,
    rollFactor: 1.5,
    isPutter: true
  }
];

export class ClubManager {
  constructor() {
    this.currentIndex = 0;
  }

  getCurrentClub() {
    return CLUBS[this.currentIndex];
  }

  nextClub() {
    this.currentIndex = (this.currentIndex + 1) % CLUBS.length;
    return this.getCurrentClub();
  }

  prevClub() {
    this.currentIndex = (this.currentIndex - 1 + CLUBS.length) % CLUBS.length;
    return this.getCurrentClub();
  }

  selectClubById(id) {
    const idx = CLUBS.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.currentIndex = idx;
    }
    return this.getCurrentClub();
  }
}
