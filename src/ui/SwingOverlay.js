import { SWING_STATES } from '../mechanics/SwingMeter.js';

/**
 * Side-View Swing Overlay (Links LS 98 / Arcade 16-Bit Style Pop-Up Stage)
 * Prominently displays Sophie's large pixel-art sprite (180-220px) in side profile
 * with 3-click swing meter, swing animation, and impact flash.
 */
export class SwingOverlay {
  constructor(game) {
    this.game = game;
    
    // Overlay DOM Elements
    this.modalEl = document.getElementById('swing-modal');
    this.canvasEl = document.getElementById('swing-canvas');
    this.ctx = this.canvasEl ? this.canvasEl.getContext('2d') : null;
    if (this.ctx) this.ctx.imageSmoothingEnabled = false;

    // Swing meter elements inside modal
    this.meterFill = document.getElementById('modal-meter-fill');
    this.meterCursor = document.getElementById('modal-meter-cursor');
    this.statusText = document.getElementById('modal-status-text');

    this.isOpen = false;
    this.bgSkyGradient = null;
  }

  show() {
    this.isOpen = true;
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
  }

  hide() {
    this.isOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  updateMeterUI(meter) {
    const pos = meter.cursorPos;
    if (this.meterCursor) {
      this.meterCursor.style.left = `${pos}%`;
    }

    if (meter.state === SWING_STATES.POWER_GAUGE) {
      if (this.meterFill) this.meterFill.style.width = `${pos}%`;
      if (this.statusText) this.statusText.innerText = `CLICK SPACE / TAP: LOCK POWER (${Math.round(pos)}%)`;
    } else if (meter.state === SWING_STATES.SNAP_GAUGE) {
      if (this.statusText) this.statusText.innerText = 'CLICK SPACE / TAP: SNAP AT 0% BASELINE!';
    } else if (meter.state === SWING_STATES.IDLE) {
      if (this.meterFill) this.meterFill.style.width = '0%';
      if (this.statusText) this.statusText.innerText = 'CLICK SPACE / TAP TO START POWER GAUGE';
    }
  }

  render(player, spriteSheet, spriteMeta) {
    if (!this.isOpen || !this.ctx) return;

    const w = this.canvasEl.width || 640;
    const h = this.canvasEl.height || 360;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 1. Render 16-Bit Side Profile Scenery & Sky Backdrop
    if (!this.bgSkyGradient) {
      this.bgSkyGradient = ctx.createLinearGradient(0, 0, 0, h);
      this.bgSkyGradient.addColorStop(0, '#1a237e');  // Deep twilight blue sky
      this.bgSkyGradient.addColorStop(0.55, '#0288d1'); // Arcade blue horizon
      this.bgSkyGradient.addColorStop(0.72, '#2e7d32'); // Far fairway hills
      this.bgSkyGradient.addColorStop(1, '#1b5e20');    // Turf ground
    }
    ctx.fillStyle = this.bgSkyGradient;
    ctx.fillRect(0, 0, w, h);

    // Distant Pixel Trees & Scenery
    ctx.fillStyle = '#0a3200';
    for (let i = 0; i < w; i += 30) {
      const treeH = 35 + Math.sin(i * 0.1) * 15;
      ctx.beginPath();
      ctx.arc(i + 15, h * 0.72 - treeH / 2, treeH / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Render Lush Side-View Turf Ground Baseline
    const groundY = h * 0.76;
    ctx.fillStyle = '#2e7d32'; // Fairway green turf
    ctx.fillRect(0, groundY, w, h - groundY);

    ctx.fillStyle = '#388e3c'; // Top grass trim line
    ctx.fillRect(0, groundY, w, 4);

    // Tee Box Marker
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.32 - 12, groundY - 6, 8, 6);
    ctx.fillRect(w * 0.32 + 35, groundY - 6, 8, 6);

    // 3. Render Large Side Profile Golf Ball on Turf
    const ballX = w * 0.32 + 10;
    const ballY = groundY - 4;

    if (player.animState !== 'IMPACT' && player.animState !== 'FOLLOW_THROUGH') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(ballX, groundY + 1, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Render Large Prominent Sophie 16-Bit Player Character Sprite (Side Profile)
    const playerX = w * 0.32 - 45;
    const playerY = groundY - 10;
    const largeRenderSize = 200; // PROMINENT LARGE ARCADE SPRITE!

    ctx.save();
    ctx.translate(playerX, playerY);

    if (spriteSheet) {
      const meta = spriteMeta || { cols: 4, rows: 2, frameWidth: 1086, frameHeight: 1448 };
      const cols = meta.cols || 4;
      const frame = player.currentFrame % 8;
      const col = frame % cols;
      const row = Math.floor(frame / cols);

      const srcX = col * meta.frameWidth;
      const srcY = row * meta.frameHeight;

      // Player ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 10, largeRenderSize * 0.22, largeRenderSize * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Render Large Sophie Sprite facing target right
      ctx.drawImage(
        spriteSheet,
        srcX, srcY, meta.frameWidth, meta.frameHeight,
        -largeRenderSize / 2, -largeRenderSize + 15, largeRenderSize, largeRenderSize
      );

      // Impact Flash on Frame 5/6
      if (player.animState === 'IMPACT') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ballX - playerX, ballY - playerY, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(ballX - playerX, ballY - playerY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#d500f9';
      ctx.fillRect(-20, -100, 40, 100);
    }

    ctx.restore();
  }
}
