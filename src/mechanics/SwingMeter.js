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
    this.speed = 1.75;  // Gauge speed
    this.direction = 1; // 1 = forward to 110%, -1 = returning to 0%
    
    // Shot input parameters
    this.powerInput = 0;        // 0.0 to 1.10
    this.isOverswing = false;   // True if power > 100%
    this.overswingPenalty = 0; // 0.0 to 1.0 instability factor
    this.snapError = 0;        // 0.0 = perfect, -1.0 = hook, +1.0 = slice
    this.shotTypeLabel = 'CONTROLLED';

    // Baseline sweet spot position at 0%
    this.sweetSpot = 2.5;
    // How far past the 0% baseline the cursor may travel before it counts as a
    // total whiff - gives the SLICE outcome a real, clickable window.
    this.missFloor = -22;

    // Callbacks
    this.onStateChange = null;
    this.onShotTriggered = null;
  }

  reset() {
    this.state = SWING_STATES.IDLE;
    this.cursorPos = 0;
    this.direction = 1;
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
        // CLICK 1: Start backswing moving forward from 0% baseline towards 110%
        this.state = SWING_STATES.POWER_GAUGE;
        this.cursorPos = 0;
        this.direction = 1;
        this.lockedPowerPos = null;
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.POWER_GAUGE:
        // CLICK 2: Set power input (Partial < 100%, Controlled = 100%, Overswing > 100%)
        this.lockedPowerPos = this.cursorPos;
        this.powerInput = Math.min(1.10, Math.max(0.10, this.cursorPos / 100));

        if (this.cursorPos > 100) {
          // Beyond 100% = OVERSWING!
          this.isOverswing = true;
          this.overswingPenalty = (this.cursorPos - 100) / 10; // 0.0 to 1.0 scale
          this.shotTypeLabel = 'OVERSWING';
        } else if (this.cursorPos >= 96) {
          // At 100% = Controlled full shot
          this.isOverswing = false;
          this.overswingPenalty = 0;
          this.shotTypeLabel = 'FULL SHOT';
        } else {
          // Before 100% = Partial shot
          this.isOverswing = false;
          this.overswingPenalty = 0;
          this.shotTypeLabel = 'PARTIAL SHOT';
        }

        // Reverse cursor towards 0% baseline for accuracy snap
        this.state = SWING_STATES.SNAP_GAUGE;
        this.direction = -1;
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.SNAP_GAUGE:
        // CLICK 3: Set impact accuracy at 0% baseline
        const diff = this.cursorPos - this.sweetSpot;

        if (Math.abs(diff) <= 3.5) {
          // PERFECT SNAP -> Intended shot!
          this.snapError = 0.0;
        } else if (diff > 3.5) {
          // Early click (before baseline) -> HOOK
          this.snapError = -Math.min(1.0, (diff - 3.5) / 22);
        } else {
          // Late click (past baseline) -> SLICE
          this.snapError = Math.min(1.0, Math.abs(diff + 3.5) / 15);
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
            isPerfect: Math.abs(diff) <= 3.5
          });
        }
        break;

      case SWING_STATES.COMPLETE:
        break;
    }
  }

  update(dt = 1) {
    if (this.state === SWING_STATES.POWER_GAUGE) {
      this.cursorPos += this.speed * this.direction * dt;
      if (this.cursorPos >= 110) {
        this.cursorPos = 110;
        this.direction = -1; // Auto reverse at 110% max overswing
      } else if (this.cursorPos <= 0) {
        this.cursorPos = 0;
        this.direction = 1; // Auto reverse at 0% - without this the cursor ran away
                             // to arbitrarily negative % if the player hesitated on click 2
      }
    } else if (this.state === SWING_STATES.SNAP_GAUGE) {
      // Faster return speed if overswinging to add snap challenge
      const returnSpeed = this.speed * (1.25 + this.overswingPenalty * 0.35);
      this.cursorPos += returnSpeed * this.direction * dt;

      // Let the cursor travel past the 0% baseline so a late click can still
      // land in the SLICE zone (previously clamping at 0 made SLICE unreachable
      // by clicking - it could only happen via a total whiff below).
      if (this.cursorPos <= this.missFloor) {
        // Ran all the way past the baseline with no click -> total whiff / worst-case slice
        this.cursorPos = this.missFloor;
        this.snapError = 1.0; // Slice
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
