/**
 * Classic 16-Bit 3-Click Swing Power & Accuracy Gauge Machine
 * Click 1: Start Power Gauge
 * Click 2: Lock Power Percentage (0% - 100%)
 * Click 3: Lock Snap Accuracy (Hook / Sweet Spot / Slice)
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
    this.speed = 2.2;    // Gauge speed
    this.direction = 1;  // 1 = moving forward, -1 = returning
    
    this.lockedPower = 0; // 0.0 to 1.0
    this.lockedSnap = 0;  // -1.0 (heavy hook), 0.0 (perfect sweet spot), +1.0 (heavy slice)

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
        // Click 1: Start Power Gauge moving forward
        this.state = SWING_STATES.POWER_GAUGE;
        this.cursorPos = 0;
        this.direction = 1;
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.POWER_GAUGE:
        // Click 2: Lock Power % and reverse direction towards snap sweet spot
        this.lockedPower = Math.min(1.0, Math.max(0.05, this.cursorPos / 100));
        this.state = SWING_STATES.SNAP_GAUGE;
        this.direction = -1; // Moving back towards snap point
        if (this.onStateChange) this.onStateChange(this.state);
        break;

      case SWING_STATES.SNAP_GAUGE:
        // Click 3: Lock Accuracy Snap
        // Sweet spot is at ~50% on return
        const sweetSpot = 50;
        const diff = this.cursorPos - sweetSpot;
        // Normalize snap offset between -1.0 and +1.0
        this.lockedSnap = Math.min(1.0, Math.max(-1.0, diff / 25));
        
        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            power: this.lockedPower,
            snap: this.lockedSnap,
            isPerfect: Math.abs(diff) <= 3
          });
        }
        break;

      case SWING_STATES.COMPLETE:
        // Already triggered
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
      this.cursorPos += this.speed * 1.3 * this.direction;
      if (this.cursorPos <= 0) {
        // Missed snap point! Heavy shank/slice
        this.cursorPos = 0;
        this.lockedSnap = 1.0; // Max slice
        this.state = SWING_STATES.COMPLETE;
        if (this.onStateChange) this.onStateChange(this.state);
        if (this.onShotTriggered) {
          this.onShotTriggered({
            power: this.lockedPower,
            snap: 1.0,
            isPerfect: false
          });
        }
      }
    }
  }
}
