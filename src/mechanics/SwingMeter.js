/**
 * Authentic 3-Click Swing System & Power / Accuracy Machine
 * 
 * CLICK 1: Start backswing (meter moves from 0% baseline towards 110%).
 * CLICK 2: Set power input:
 *   - Before 100%: Partial shot (e.g. 80%, 90% power)
 *   - At 100%: Controlled full shot (100% optimal power)
 *   - Beyond 100% (100%-110%): Overswing (adds extra power + overswing penalty dispersion!)
 * CLICK 3: Set impact accuracy:
 *   - Early (clicked before 0% baseline): HOOK (curving left)
 *   - Perfect (clicked on 0% baseline): Intended straight shot
 *   - Late (clicked past 0% baseline / missed): SLICE (curving right)
 */

export const SWING_STATES = {
  IDLE: 'IDLE',
  POWER_GAUGE: 'POWER_GAUGE',
  SNAP_GAUGE: 'SNAP_GAUGE',
  COMPLETE: 'COMPLETE'
};

export class SwingMeter {
  constructor() {
    this.state = SWING_STATES.IDLE;
    this.cursorPos = 0; // 0% to 110%
    
    // Base speed tuned so 0% to 100% sweep takes ~1.35 seconds at 60 FPS
    this.baseSpeed = 1.23; 
    this.shotSpeedMultiplier = 1.0; // 1.0 = Full shot, 0.75 = Pitch/Chip/Flop (25% slower)
    this.direction = 1; // 1 = forward up arc, -1 = returning down arc
    
    // Pause timer at top of backswing (150ms pause on Click 2)
    this.topPauseTimer = 0;
    this.topPauseDuration = 9; // ~150ms at 60 FPS (9 frames)
    
    // Shot input parameters
    this.powerInput = 0;        // 0.0 to 1.10
    this.lockedPowerPos = null;
    this.isOverswing = false;   // True if power > 100%
    this.overswingPenalty = 0; // 0.0 to 1.0 instability factor
    this.snapError = 0;        // 0.0 = perfect, -1.0 = hook, +1.0 = slice
    this.shotTypeLabel = 'CONTROLLED';

    // Baseline sweet spot position at 0%
    this.sweetSpot = 0;
    // Sweet spot snap area tolerance (+-5.0% = ~14 degree arc on 270deg circular meter)
    this.sweetSpotTolerance = 5.0;
    
    // How far past 0% baseline cursor travels before total whiff
    this.missFloor = -22;

    // Callbacks
    this.onStateChange = null;
    this.onShotTriggered = null;
  }

  setShotType(shotType) {
    const id = (typeof shotType === 'string') ? shotType.toUpperCase() : (shotType?.id || 'FULL').toUpperCase();
    if (id === 'PITCH' || id === 'CHIP' || id === 'FLOP') {
      this.shotSpeedMultiplier = 0.75; // Extra 25% slower for short game touch
    } else {
      this.shotSpeedMultiplier = 1.0;  // Standard 1.2s - 1.35s sweep
    }
  }

  reset() {
    this.state = SWING_STATES.IDLE;
    this.cursorPos = 0;
    this.direction = 1;
    this.topPauseTimer = 0;
    this.powerInput = 0;
    this.lockedPowerPos = null;
    this.isOverswing = false;
    this.overswingPenalty = 0;
    this.snapError = 0;
    this.shotTypeLabel = 'CONTROLLED';
    if (this.onStateChange) this.onStateChange(this.state);
  }

  handleClick() {
    switch (this.state) {
      case SWING_STATES.IDLE:
        // CLICK 1: Start backswing moving counter-clockwise from 0% towards 110%
        this.state = SWING_STATES.POWER_GAUGE;
        this.cursorPos = 0;
        this.direction = 1;
        this.lockedPowerPos = null;
        this.topPauseTimer = 0;
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.POWER_GAUGE:
        // CLICK 2: Set power input (Partial < 100%, Controlled = 100%, Overswing > 100%)
        this.lockedPowerPos = this.cursorPos;
        this.powerInput = Math.min(1.10, Math.max(0.10, this.cursorPos / 100));

        if (this.cursorPos > 100) {
          this.isOverswing = true;
          this.overswingPenalty = (this.cursorPos - 100) / 10;
          this.shotTypeLabel = 'OVERSWING';
        } else if (this.cursorPos >= 95) {
          this.isOverswing = false;
          this.overswingPenalty = 0;
          this.shotTypeLabel = 'FULL SHOT';
        } else {
          this.isOverswing = false;
          this.overswingPenalty = 0;
          this.shotTypeLabel = 'PARTIAL SHOT';
        }

        // 150ms Top-Pause at apex before sweeping down to accuracy target
        this.state = SWING_STATES.SNAP_GAUGE;
        this.direction = -1;
        this.topPauseTimer = this.topPauseDuration; // 150ms pause
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.SNAP_GAUGE:
        // CLICK 3: Set impact accuracy at 0% baseline (Sweet Spot +-5.0% = ~14 deg arc)
        const diff = this.cursorPos - this.sweetSpot;

        if (Math.abs(diff) <= this.sweetSpotTolerance) {
          // PERFECT SNAP -> Intended straight shot!
          this.snapError = 0.0;
        } else if (diff > this.sweetSpotTolerance) {
          // Early click (before baseline) -> HOOK
          this.snapError = -Math.min(1.0, (diff - this.sweetSpotTolerance) / 20);
        } else {
          // Late click (past baseline) -> SLICE
          this.snapError = Math.min(1.0, Math.abs(diff + this.sweetSpotTolerance) / 15);
        }

        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            powerInput: this.powerInput,
            isOverswing: this.isOverswing,
            overswingPenalty: this.overswingPenalty,
            snapError: this.snapError,
            shotTypeLabel: this.shotTypeLabel,
            isPerfect: Math.abs(diff) <= this.sweetSpotTolerance
          });
        }
        break;

      case SWING_STATES.COMPLETE:
        break;
    }
  }

  update(dt = 1) {
    const currentSpeed = this.baseSpeed * this.shotSpeedMultiplier * dt;

    if (this.state === SWING_STATES.POWER_GAUGE) {
      this.cursorPos += currentSpeed * this.direction;
      if (this.cursorPos >= 110) {
        this.cursorPos = 110;
        this.direction = -1; // Auto reverse at max overswing
      } else if (this.cursorPos <= 0) {
        this.cursorPos = 0;
        this.direction = 1;
      }
    } else if (this.state === SWING_STATES.SNAP_GAUGE) {
      // 150ms Apex Micro-Pause on Click 2
      if (this.topPauseTimer > 0) {
        this.topPauseTimer -= dt;
        return; // Hold cursor at locked power position during 150ms pause
      }

      // Return down towards accuracy target (slightly faster if overswinging)
      const returnSpeed = currentSpeed * (1.15 + this.overswingPenalty * 0.25);
      this.cursorPos += returnSpeed * this.direction;

      if (this.cursorPos <= this.missFloor) {
        // Total Whiff / Missed snap -> Maximum Slice
        this.cursorPos = this.missFloor;
        this.snapError = 1.0;
        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            powerInput: this.powerInput,
            isOverswing: this.isOverswing,
            overswingPenalty: this.overswingPenalty,
            snapError: 1.0,
            shotTypeLabel: this.shotTypeLabel,
            isPerfect: false
          });
        }
      }
    }
  }
}
