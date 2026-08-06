import { SWING_STATES } from '../mechanics/SwingMeter.js';

/**
 * 16-Bit SNES Arcade HUD UI Manager
 */
export class HUD {
  constructor(game) {
    this.game = game;

    // DOM Elements
    this.elHoleNum = document.getElementById('hud-hole-num');
    this.elParVal = document.getElementById('hud-par-val');
    this.elDistVal = document.getElementById('hud-dist-val');
    this.elScoreVal = document.getElementById('hud-score-val');
    this.elWindVal = document.getElementById('hud-wind-val');
    this.elWindArrow = document.getElementById('hud-wind-arrow');

    this.elClubName = document.getElementById('hud-club-name');
    this.elClubDist = document.getElementById('hud-club-dist');
    this.btnClubPrev = document.getElementById('btn-club-prev');
    this.btnClubNext = document.getElementById('btn-club-next');

    this.meterFill = document.getElementById('meter-power-fill');
    this.meterCursor = document.getElementById('meter-cursor');
    this.meterStatusText = document.getElementById('meter-status-text');

    this.selectHole = document.getElementById('select-hole');
    this.btnCrtToggle = document.getElementById('btn-crt-toggle');
    this.btnAudioToggle = document.getElementById('btn-audio-toggle');
    this.btnResetShot = document.getElementById('btn-reset-shot');
    this.crtOverlay = document.getElementById('crt-overlay');

    this.gameBanner = document.getElementById('game-banner');
    this.bannerTitle = document.getElementById('banner-text');
    this.bannerSubtitle = document.getElementById('banner-subtext');

    this.shotPopup = document.getElementById('shot-popup');
    this.shotResultText = document.getElementById('shot-result-text');

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.btnClubPrev.addEventListener('click', () => this.game.changeClub(-1));
    this.btnClubNext.addEventListener('click', () => this.game.changeClub(1));

    this.selectHole.addEventListener('change', (e) => {
      this.game.switchHole(parseInt(e.target.value, 10));
    });

    this.btnCrtToggle.addEventListener('click', () => {
      const active = this.crtOverlay.classList.toggle('disabled');
      this.btnCrtToggle.classList.toggle('active', !active);
    });

    this.btnAudioToggle.addEventListener('click', () => {
      const enabled = this.game.audioEngine.toggleSound();
      this.btnAudioToggle.classList.toggle('active', enabled);
      this.btnAudioToggle.innerText = enabled ? 'SFX ON' : 'SFX OFF';
    });

    this.btnResetShot.addEventListener('click', () => {
      this.game.resetCurrentShot();
    });
  }

  updateHoleInfo(meta, distanceYards, scoreText) {
    if (this.elHoleNum) this.elHoleNum.innerText = meta.hole;
    if (this.elParVal) this.elParVal.innerText = meta.par;
    if (this.elDistVal) this.elDistVal.innerText = `${distanceYards} YDS`;
    if (this.elScoreVal) this.elScoreVal.innerText = scoreText;
    if (this.selectHole) this.selectHole.value = meta.hole;
  }

  updateWind(speed, dirAngle) {
    if (this.elWindVal) this.elWindVal.innerText = `${speed} MPH`;
    if (this.elWindArrow) {
      this.elWindArrow.style.transform = `rotate(${dirAngle}deg)`;
    }
  }

  updateClubInfo(club) {
    if (this.elClubName) this.elClubName.innerText = club.name;
    if (this.elClubDist) this.elClubDist.innerText = `${club.maxDistance} YDS`;
  }

  updateSwingMeter(meter) {
    const pos = meter.cursorPos;
    if (this.meterCursor) {
      this.meterCursor.style.left = `${pos}%`;
    }

    if (meter.state === SWING_STATES.POWER_GAUGE) {
      if (this.meterFill) this.meterFill.style.width = `${pos}%`;
      if (this.meterStatusText) this.meterStatusText.innerText = `CLICK SPACE: SET POWER (${Math.round(pos)}%)`;
    } else if (meter.state === SWING_STATES.SNAP_GAUGE) {
      if (this.meterStatusText) this.meterStatusText.innerText = 'CLICK SPACE: SNAP SWEET SPOT!';
    } else if (meter.state === SWING_STATES.IDLE) {
      if (this.meterFill) this.meterFill.style.width = '0%';
      if (this.meterStatusText) this.meterStatusText.innerText = 'PRESS SPACE / CLICK TO SWING';
    }
  }

  showBanner(title, subtitle, duration = 3000) {
    if (this.bannerTitle) this.bannerTitle.innerText = title;
    if (this.bannerSubtitle) this.bannerSubtitle.innerText = subtitle;
    this.gameBanner.classList.remove('hidden');

    if (duration > 0) {
      setTimeout(() => {
        this.gameBanner.classList.add('hidden');
      }, duration);
    }
  }

  showShotPopup(text, duration = 1800) {
    if (this.shotResultText) this.shotResultText.innerText = text;
    this.shotPopup.classList.remove('hidden');
    setTimeout(() => {
      this.shotPopup.classList.add('hidden');
    }, duration);
  }
}
