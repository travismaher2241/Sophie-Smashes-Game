/**
 * Player Animation Controller (Sophie)
 * 16-Bit Character Rendering, Uniform Sprite Scaling & Swing Frame Machine
 */

export const PLAYER_ANIM_STATES = {
  ADDRESS: 'ADDRESS',
  BACKSWING: 'BACKSWING',
  TOP: 'TOP',
  DOWNSWING: 'DOWNSWING',
  IMPACT: 'IMPACT',
  FOLLOW_THROUGH: 'FOLLOW_THROUGH'
};

export class PlayerController {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.aimAngle = -Math.PI / 2; // Facing north towards pin by default
    
    // Animation properties
    this.animState = PLAYER_ANIM_STATES.ADDRESS;
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.isPlayingSwing = false;

    // Callbacks
    this.onImpactFrame = null;
    this.onSwingComplete = null;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setAimAngle(angle) {
    this.aimAngle = angle;
  }

  startSwingAnimation() {
    this.isPlayingSwing = true;
    this.animState = PLAYER_ANIM_STATES.BACKSWING;
    this.currentFrame = 0;
    this.frameTimer = 0;
  }

  resetToAddress() {
    this.isPlayingSwing = false;
    this.animState = PLAYER_ANIM_STATES.ADDRESS;
    this.currentFrame = 0;
    this.frameTimer = 0;
  }

  update() {
    if (!this.isPlayingSwing) {
      // Idle Address wiggle (alternates frames 0 and 1)
      this.frameTimer++;
      if (this.frameTimer > 40) {
        this.currentFrame = (this.currentFrame === 0) ? 1 : 0;
        this.frameTimer = 0;
      }
      return;
    }

    // Active Swing Animation Frame Sequencing
    this.frameTimer++;
    const frameDelay = 6; // Frames per animation tick

    if (this.frameTimer >= frameDelay) {
      this.frameTimer = 0;
      this.currentFrame++;

      // Frame mapping (8 frames total):
      // Frame 0 & 1: Address
      // Frame 2 & 3: Backswing
      // Frame 4: Top of swing
      // Frame 5: Downswing
      // Frame 6: Impact snap!
      // Frame 7: Follow Through

      if (this.currentFrame === 2) this.animState = PLAYER_ANIM_STATES.BACKSWING;
      if (this.currentFrame === 3) this.animState = PLAYER_ANIM_STATES.TOP;
      if (this.currentFrame === 4) this.animState = PLAYER_ANIM_STATES.DOWNSWING;

      if (this.currentFrame === 5) {
        this.animState = PLAYER_ANIM_STATES.IMPACT;
        if (this.onImpactFrame) {
          this.onImpactFrame();
        }
      }

      if (this.currentFrame === 6 || this.currentFrame === 7) {
        this.animState = PLAYER_ANIM_STATES.FOLLOW_THROUGH;
      }

      if (this.currentFrame >= 8) {
        this.currentFrame = 7; // Hold follow-through pose
        this.isPlayingSwing = false;
        if (this.onSwingComplete) {
          this.onSwingComplete();
        }
      }
    }
  }

  render(ctx, spriteSheet, spriteMetadata) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Rotate Sophie sprite to align with aim vector
    ctx.rotate(this.aimAngle + Math.PI / 2);

    if (spriteSheet) {
      const meta = spriteMetadata || { cols: 4, rows: 2, frameWidth: 1086, frameHeight: 1448 };
      const cols = meta.cols || 4;
      const frame = this.currentFrame % 8;
      const col = frame % cols;
      const row = Math.floor(frame / cols);

      const srcX = col * meta.frameWidth;
      const srcY = row * meta.frameHeight;

      // Strict Uniform Destination Box: 100px width x 133px height (fixed 1:1.33 ratio)
      const renderW = 100;
      const renderH = 133;

      // Character ground shadow pinned at feet baseline
      ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
      ctx.beginPath();
      ctx.ellipse(0, 0, renderW * 0.22, renderW * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();

      // Render Sophie sprite with strict bottom-center anchor
      // -renderW / 2 horizontally centered, -renderH + 4 vertically anchored at feet!
      ctx.drawImage(
        spriteSheet,
        srcX, srcY, meta.frameWidth, meta.frameHeight,
        -renderW / 2, -renderH + 4, renderW, renderH
      );
    } else {
      ctx.fillStyle = '#d500f9';
      ctx.fillRect(-12, -24, 24, 24);
    }

    ctx.restore();
  }
}
