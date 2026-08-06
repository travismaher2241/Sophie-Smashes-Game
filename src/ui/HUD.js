import { SWING_STATES } from '../mechanics/SwingMeter.js';

/**
 * 16-Bit SNES Arcade & Links LS 98 Style HUD UI Manager
 * Controls Welcome / Start Title Page <-> Top-Down Strategy View <-> Side-View Swing Overlay
 */
export class HUD {
  constructor(game) {
    this.game = game;

    // Welcome / Start Title Screen
    this.titleScreen = document.getElementById('title-screen');
    this.btnStartGame = document.getElementById('btn-start-game');
    this.btnTitleReturn = document.getElementById('btn-title-return');

    // DOM Elements - Top Strategy Bar
    this.elHoleNum = document.getElementById('hud-hole-num');
    this.elParVal = document.getElementById('hud-par-val');
    this.elDistVal = document.getElementById('hud-dist-val');
    this.elScoreVal = document.getElementById('hud-score-val');
    this.elWindVal = document.getElementById('hud-wind-val');
    this.elWindArrow = document.getElementById('hud-wind-arrow');

    // Controls - 14-Club Bag
    this.elClubName = document.getElementById('hud-club-name');
    this.elClubDist = document.getElementById('hud-club-dist');
    this.btnClubPrev = document.getElementById('btn-club-prev');
    this.btnClubNext = document.getElementById('btn-club-next');

    // Controls - Shot Modes (Full, Pitch, Chip, Flop)
    this.elShotMode = document.getElementById('hud-shot-mode');
    this.btnShotPrev = document.getElementById('btn-shot-prev');
    this.btnShotNext = document.getElementById('btn-shot-next');

    this.btnAimLeft = document.getElementById('btn-aim-left');
    this.btnAimRight = document.getElementById('btn-aim-right');
    this.btnOpenSwing = document.getElementById('btn-open-swing');
    this.btnCloseSwing = document.getElementById('btn-close-swing');

    this.selectHole = document.getElementById('select-hole');
    this.btnMapToggle = document.getElementById('btn-map-toggle');
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
    const triggerStart = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      this.game.startGameFromTitle();
    };

    if (this.btnStartGame) {
      this.btnStartGame.addEventListener('click', triggerStart);
      this.btnStartGame.addEventListener('touchstart', triggerStart, { passive: false });
      this.btnStartGame.addEventListener('pointerdown', triggerStart);
    }

    if (this.titleScreen) {
      this.titleScreen.addEventListener('click', triggerStart);
    }

    if (this.btnTitleReturn) {
      this.btnTitleReturn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.showTitleScreen();
      });
    }

    this.btnClubPrev.addEventListener('click', () => this.game.changeClub(-1));
    this.btnClubNext.addEventListener('click', () => this.game.changeClub(1));

    if (this.btnShotPrev) this.btnShotPrev.addEventListener('click', () => this.game.changeShotType(-1));
    if (this.btnShotNext) this.btnShotNext.addEventListener('click', () => this.game.changeShotType(1));

    if (this.btnAimLeft) this.btnAimLeft.addEventListener('click', () => this.game.adjustAim(-0.06));
    if (this.btnAimRight) this.btnAimRight.addEventListener('click', () => this.game.adjustAim(0.06));

    if (this.btnOpenSwing) {
      // Route through handleActionTrigger (not openSwingOverlay directly) so a mouse/touch
      // click on this button behaves identically to a Spacebar press: it opens the swing
      // stage AND fires click 1 (start backswing) in one action, matching the keyboard flow.
      this.btnOpenSwing.addEventListener('click', () => this.game.handleActionTrigger());
    }

    if (this.btnCloseSwing) {
      this.btnCloseSwing.addEventListener('click', () => this.game.closeSwingOverlay());
    }

    this.selectHole.addEventListener('change', (e) => {
      this.game.switchHole(parseInt(e.target.value, 10));
    });

    if (this.btnMapToggle) {
      this.btnMapToggle.addEventListener('click', () => {
        const isFull = this.game.toggleFullOverview();
        this.btnMapToggle.classList.toggle('active', isFull);
        this.btnMapToggle.innerText = isFull ? 'AIM VIEW' : 'FULL MAP';
      });
    }

    this.btnCrtToggle.addEventListener('click', () => {
      const active = this.crtOverlay.classList.toggle('disabled');
      this.btnCrtToggle.classList.toggle('active', !active);
    });

    this.btnAudioToggle.addEventListener('click', () => {
      const enabled = this.game.audioEngine.toggleSound();
      this.btnAudioToggle.classList.toggle('active', enabled);
      this.btnAudioToggle.innerText = enabled ? 'SFX ON' : 'SFX OFF';
    });

    if (this.btnResetShot) {
      this.btnResetShot.addEventListener('click', () => {
        this.game.resetCurrentShot();
      });
    }
  }

  showTitleOverlay() {
    if (this.titleScreen) {
      this.titleScreen.style.display = 'flex';
      this.titleScreen.classList.remove('hidden');
    }
  }

  hideTitleOverlay() {
    if (this.titleScreen) {
      this.titleScreen.classList.add('hidden');
      this.titleScreen.style.display = 'none';
    }
  }

  updateHoleInfo(meta, distanceMeters, scoreText) {
    if (this.elHoleNum) this.elHoleNum.innerText = meta.hole;
    if (this.elParVal) this.elParVal.innerText = meta.par;
    if (this.elDistVal) this.elDistVal.innerText = `${distanceMeters}m`;
    if (this.elScoreVal) this.elScoreVal.innerText = scoreText;
    if (this.selectHole) this.selectHole.value = meta.hole;
  }

  updateWind(speed, dirAngle) {
    if (this.elWindVal) this.elWindVal.innerText = `${speed} MPH`;
    if (this.elWindArrow) {
      this.elWindArrow.style.transform = `rotate(${dirAngle}deg)`;
    }
  }

  updateClubInfo(club, effectiveDist) {
    if (this.elClubName) this.elClubName.innerText = club.name;
    if (this.elClubDist) this.elClubDist.innerText = `${effectiveDist || club.maxDistance}m`;
  }

  updateShotTypeInfo(shotType) {
    if (this.elShotMode) this.elShotMode.innerText = shotType.name;
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
