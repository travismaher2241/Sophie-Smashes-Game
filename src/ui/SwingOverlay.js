import { SWING_STATES } from '../mechanics/SwingMeter.js';

/**
 * Side-View Swing Overlay (Links LS 98 / Arcade 16-Bit Style Pop-Up Stage)
 * Prominently displays Sophie's large pixel-art sprite (180x240px uniform box)
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
    if (!this.statusText) return;
    if (meter.state === SWING_STATES.POWER_GAUGE) {
      this.statusText.innerText = `CLICK 2: LOCK POWER (${Math.round(meter.cursorPos)}%)`;
    } else if (meter.state === SWING_STATES.SNAP_GAUGE) {
      this.statusText.innerText = 'CLICK 3: TIME ACCURACY SNAP!';
    } else if (meter.state === SWING_STATES.IDLE) {
      this.statusText.innerText = 'CLICK 1: START BACKSWING';
    } else if (meter.state === SWING_STATES.COMPLETE) {
      this.statusText.innerText = meter.isPerfect ? 'PERFECT SNAP!' : 'SWING EXECUTED!';
    }
  }

  renderCircularGauge(ctx, meter, w, h) {
    if (!meter) return;

    const cx = w - 100;
    const cy = h - 100;
    const outerR = 64;
    const innerR = 44;
    const midR = (outerR + innerR) / 2;
    const thickness = outerR - innerR;

    // Angle mapping: 0% = Math.PI / 2 (bottom center)
    // 110% = Math.PI / 2 - 1.5 * Math.PI = -Math.PI (left 9 o'clock)
    const posToAngle = (pos) => Math.PI / 2 - (pos / 110) * (1.5 * Math.PI);

    ctx.save();

    // 1. Dark Translucent Outer Frame
    ctx.fillStyle = 'rgba(8, 18, 38, 0.88)';
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gauge Title Header
    ctx.font = '700 9px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffeb3b';
    ctx.textAlign = 'center';
    ctx.fillText('3-CLICK GAUGE', cx, cy - outerR - 6);

    // Key Angles
    const angle0 = posToAngle(0);
    const angle110 = posToAngle(110);
    const angle100 = posToAngle(100);
    const angle96 = posToAngle(96);

    // 2. Track Base Background Arc
    ctx.beginPath();
    ctx.arc(cx, cy, midR, angle110, angle0, false);
    ctx.strokeStyle = 'rgba(25, 45, 75, 0.95)';
    ctx.lineWidth = thickness;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle110, angle0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, angle110, angle0, false);
    ctx.stroke();

    // 3. Color Zones
    // a) Power Zone (0% to 96%) - Green Arc
    ctx.beginPath();
    ctx.arc(cx, cy, midR, angle0, angle96, true);
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = thickness - 4;
    ctx.stroke();

    // b) White Target Band at 100% Power (96% to 100%)
    ctx.beginPath();
    ctx.arc(cx, cy, midR, angle96, angle100, true);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = thickness;
    ctx.stroke();

    ctx.strokeStyle = '#ffea00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 2, angle96, angle100, true);
    ctx.stroke();

    // c) Red Overswing Penalty Zone (100% to 110%)
    ctx.beginPath();
    ctx.arc(cx, cy, midR, angle100, angle110, true);
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = thickness;
    ctx.stroke();

    // d) White Sweet Spot Target Band at Bottom Center (Accuracy Snap 0% - 14 deg arc)
    const snapLeftAng = posToAngle(-5.0);
    const snapRightAng = posToAngle(5.0);
    ctx.beginPath();
    ctx.arc(cx, cy, midR, snapLeftAng, snapRightAng, true);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = thickness + 3;
    ctx.stroke();

    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 3, snapLeftAng, snapRightAng, true);
    ctx.stroke();

    // 4. Zone Labels
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    const lx100 = cx + Math.cos(angle100) * (outerR + 12);
    const ly100 = cy + Math.sin(angle100) * (outerR + 12);
    ctx.fillText('100%', lx100, ly100);

    ctx.fillStyle = '#ff1744';
    const lxOver = cx + Math.cos(angle110) * (outerR + 12);
    const lyOver = cy + Math.sin(angle110) * (outerR + 12);
    ctx.fillText('MAX', lxOver, lyOver);

    ctx.fillStyle = '#00e676';
    ctx.textAlign = 'center';
    ctx.fillText('SNAP', cx, cy + outerR + 12);

    // 5. Locked Power Tick (Click 2)
    if (meter.lockedPowerPos !== null) {
      const lockedAngle = posToAngle(meter.lockedPowerPos);
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(lockedAngle) * (innerR - 4), cy + Math.sin(lockedAngle) * (innerR - 4));
      ctx.lineTo(cx + Math.cos(lockedAngle) * (outerR + 4), cy + Math.sin(lockedAngle) * (outerR + 4));
      ctx.stroke();
    }

    // 6. Rotating Needle
    const currentAngle = posToAngle(meter.cursorPos);
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00e676';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(currentAngle) * (outerR + 8), cy + Math.sin(currentAngle) * (outerR + 8));
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffea00';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(currentAngle) * (outerR + 8), cy + Math.sin(currentAngle) * (outerR + 8), 4, 0, Math.PI * 2);
    ctx.fill();

    // Center Hub
    ctx.fillStyle = '#0a1628';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px "VT323", monospace';
    ctx.fillStyle = '#00e676';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (meter.topPauseTimer > 0) {
      ctx.fillStyle = '#ffea00';
      ctx.fillText('PAUSE', cx, cy);
    } else if (meter.state === SWING_STATES.POWER_GAUGE) {
      ctx.fillText(`${Math.round(meter.cursorPos)}%`, cx, cy);
    } else if (meter.state === SWING_STATES.SNAP_GAUGE) {
      ctx.fillText('SNAP!', cx, cy);
    } else if (meter.lockedPowerPos !== null) {
      ctx.fillText(`${Math.round(meter.lockedPowerPos)}%`, cx, cy);
    } else {
      ctx.fillText('READY', cx, cy);
    }

    ctx.restore();
  }

  render(player, spriteSheet, spriteMeta, meter) {
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

    // 3. (Ball is rendered directly as part of Sophie's clubhead address point in sprite sheet)

    // 4. Render Large Prominent Sophie 16-Bit Player Sprite (Strict Uniform Bounding Box)
    const playerX = w * 0.32 - 45;
    const playerY = groundY;
    const renderW = 180;
    const renderH = 240; // Uniform 180x240px box

    ctx.save();
    ctx.translate(playerX, playerY);

    if (spriteSheet) {
      const sheetW = spriteSheet.naturalWidth || spriteSheet.width || 384;
      const sheetH = spriteSheet.naturalHeight || spriteSheet.height || 48;
      const isHighRes = (sheetW >= 4000);

      const cols = isHighRes ? 4 : 8;
      const rows = isHighRes ? 2 : 1;
      const frameW = Math.round(sheetW / cols);
      const frameH = Math.round(sheetH / rows);

      const frameIdx = Math.max(0, Math.min(7, player.currentFrame || 0));
      const col = frameIdx % cols;
      const row = Math.floor(frameIdx / cols);

      const srcX = col * frameW;
      const srcY = row * frameH;

      // Character ground shadow anchored at feet
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, renderW * 0.22, renderW * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Render Large Sophie Sprite with strict bottom-center feet anchor
      ctx.drawImage(
        spriteSheet,
        srcX, srcY, frameW, frameH,
        -renderW / 2, -renderH + 10, renderW, renderH
      );

      // Impact Flash on Frame 5/6
      if (player.animState === 'IMPACT' || frameIdx === 6) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(45, -renderH * 0.35, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(45, -renderH * 0.35, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = '#d500f9';
      ctx.fillRect(-20, -100, 40, 100);
    }

    ctx.restore();

    // 5. Render Circular Arc 3-Click Swing Gauge in Bottom Corner
    this.renderCircularGauge(ctx, meter, w, h);
  }
}
