/**
 * Authentic Links LS 98 Style 3-Click Swing Power & Accuracy Gauge
 * 
 * Click 1 (Address): Starts meter moving from 0% baseline towards 100% power.
 * Click 2 (Top of Swing): Locks Power % (0 - 100%). Cursor reverses towards 0% baseline.
 * Click 3 (Impact Snap): Locks Accuracy at 0% Baseline!
 *   - 0% Baseline Hit: PERFECT STRAIGHT SHOT (0 deviation).
 *   - Clicked Early (above 3%): HOOK (bends left).
 *   - Clicked Late / Missed 0%: SLICE (bends right).
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
    this.cursorPos = 0; // 0 to 100
    this.speed = 1.6;    // Smooth readable gauge speed
    this.direction = 1;  // 1 = forward to 100%, -1 = returning to 0%
    
    this.lockedPower = 0; // 0.0 to 1.0
    this.lockedSnap = 0;  // 0.0 = perfect straight, -1.0 = hook, +1.0 = slice

    // Baseline sweet spot is at 0% (left end)
    this.sweetSpot = 2.5;

    // Callbacks
    this.onStateChange = null;
    this.onShotTriggered = null;
  }

  reset() {
    this.state = SWING_STATES.IDLE;
    this.cursorPos = 0;
    this.direction = 1;
    this.lockedPower = 0;
    this.lockedSnap = 0;
    if (this.onStateChange) this.onStateChange(this.state);
  }

  handleClick() {
    switch (this.state) {
      case SWING_STATES.IDLE:
        // Click 1: Start Power Gauge moving forward from 0% to 100%
        this.state = SWING_STATES.POWER_GAUGE;
        this.cursorPos = 0;
        this.direction = 1;
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.POWER_GAUGE:
        // Click 2: Lock Power % at top of swing, reverse towards 0% baseline
        this.lockedPower = Math.min(1.0, Math.max(0.1, this.cursorPos / 100));
        this.state = SWING_STATES.SNAP_GAUGE;
        this.direction = -1; // Reverse back down to 0% baseline
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.SNAP_GAUGE:
        // Click 3: Lock Accuracy Snap at 0% Baseline!
        const diff = this.cursorPos - this.sweetSpot;

        if (Math.abs(diff) <= 3.5) {
          // PERFECT SWEET SPOT SNAP -> Straight shot!
          this.lockedSnap = 0.0;
        } else if (diff > 3.5) {
          // Clicked early (cursor above sweet spot) -> HOOK (bends left)
          this.lockedSnap = -Math.min(1.0, (diff - 3.5) / 25);
        } else {
          // Clicked past sweet spot -> SLICE (bends right)
          this.lockedSnap = Math.min(1.0, Math.abs(diff + 3.5) / 15);
        }

        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            power: this.lockedPower,
            snap: this.lockedSnap,
            isPerfect: Math.abs(diff) <= 3.5
          });
        }
        break;

      case SWING_STATES.COMPLETE:
        break;
    }
  }

  update() {
    if (this.state === SWING_STATES.POWER_GAUGE) {
      this.cursorPos += this.speed * this.direction;
      if (this.cursorPos >= 100) {
        this.cursorPos = 100;
        this.direction = -1; // Auto reverse at 100% max power
      }
    } else if (this.state === SWING_STATES.SNAP_GAUGE) {
      this.cursorPos += this.speed * 1.25 * this.direction;
      if (this.cursorPos <= 0) {
        // Missed baseline snap -> Late click / Slice penalty
        this.cursorPos = 0;
        this.lockedSnap = 0.85; // Slice
        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            power: this.lockedPower,
            snap: 0.85,
            isPerfect: false
          });
        }
      }
    }
  }
}
