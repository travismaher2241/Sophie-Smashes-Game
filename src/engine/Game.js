import { AssetLoader } from './AssetLoader.js';
import { SceneManager } from './SceneManager.js';
import { Camera } from './Camera.js';
import { AudioEngine } from './AudioEngine.js';
import { PlayerController } from '../entities/PlayerController.js';
import { BallPhysics } from '../entities/BallPhysics.js';
import { Flagstick } from '../entities/Flagstick.js';
import { ClubManager } from '../mechanics/Clubs.js';
import { SwingMeter, SWING_STATES } from '../mechanics/SwingMeter.js';
import { SwingOverlay } from '../ui/SwingOverlay.js';
import { HUD } from '../ui/HUD.js';
import { TERRAIN_TYPES, identifyTerrainFromColor } from '../utils/TerrainTypes.js';

export const GAME_STATES = {
  TITLE_SCREEN: 'TITLE_SCREEN',
  STRATEGY_AIM: 'STRATEGY_AIM',
  SWING_STAGE: 'SWING_STAGE',
  BALL_FLIGHT: 'BALL_FLIGHT',
  HOLE_COMPLETE: 'HOLE_COMPLETE'
};

export const PUTTING_STATES = {
  IDLE: 'IDLE',
  CHARGING: 'CHARGING',
  EXECUTED: 'EXECUTED'
};

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Responsive Canvas Setup
    this.canvas.width = 960;
    this.canvas.height = 720;

    // Core Systems
    this.assetLoader = new AssetLoader();
    this.sceneManager = null;
    this.camera = new Camera(960, 720);
    this.audioEngine = new AudioEngine();
    this.clubManager = new ClubManager();
    this.swingMeter = new SwingMeter();

    // Side-View Swing Overlay Modal
    this.swingOverlay = null;

    // Entities
    this.player = new PlayerController();
    this.ball = new BallPhysics();
    this.flagstick = new Flagstick();

    // UI & State Flags
    this.hud = null;
    this.state = GAME_STATES.TITLE_SCREEN;
    this.isPendingStart = false;
    this.assetsLoaded = false;
    this.wind = { speed: 6, dirAngle: 45 };

    // Shot aim & Putting properties
    this.aimAngle = -Math.PI / 2;
    this.isPuttingMode = false;
    this.puttingState = PUTTING_STATES.IDLE;
    this.puttPower = 0.0;
    this.puttPowerDir = 1;
    this.isDraggingPutt = false;
    this.dragStartPx = { x: 0, y: 0 };

    // Touch & Drag Panning State
    this.isDraggingMap = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Global reference for inline HTML onclick calls
    window.gameInstance = this;
    window.startGameFromTitle = () => this.startGameFromTitle();

    // Register UI & Event Listeners Immediately
    this.hud = new HUD(this);
    this.swingOverlay = new SwingOverlay(this);
    this.setupInputs();
  }

  async boot() {
    this.showTitleScreen();
    requestAnimationFrame((timestamp) => this.loop(timestamp));

    try {
      await this.assetLoader.loadAllAssets();
      this.sceneManager = new SceneManager(this.assetLoader);
      this.assetsLoaded = true;

      this.swingMeter.onStateChange = (meterState) => {
        this.audioEngine.playMenuBeep();
        if (meterState === SWING_STATES.POWER_GAUGE) {
          this.player.startBackswing();
        } else if (meterState === SWING_STATES.SNAP_GAUGE) {
          this.player.reachTop();
        } else if (meterState === SWING_STATES.COMPLETE) {
          this.player.fireDownswing();
        }
      };

      this.swingMeter.onShotTriggered = (shotResult) => {
        this.pendingShot = shotResult;
        this.player.fireDownswing();
      };

      this.player.onImpactFrame = () => {
        this.audioEngine.playImpactSnap();
        this.audioEngine.playSwingWhoosh();

        const club = this.clubManager.getCurrentClub();
        const shotType = this.clubManager.getCurrentShotType();

        const shot = this.pendingShot || {
          powerInput: 1.0,
          isOverswing: false,
          overswingPenalty: 0,
          snapError: 0.0,
          shotTypeLabel: 'FULL SHOT',
          isPerfect: true
        };

        const color = this.sceneManager.sampleTerrainPixel(this.ball.x, this.ball.y);
        const currentTerrain = identifyTerrainFromColor(color.r, color.g, color.b, color.a);
        const terrainLie = currentTerrain.lie || { powerFactor: 1.0, loftFactor: 1.0 };

        const officialMeters = this.sceneManager.currentMetadata?.meters || 300;
        const tee = this.sceneManager.getTeePosition();
        const pin = this.sceneManager.getPinPosition();
        const mapTotalPixelLength = Math.hypot(pin.x - tee.x, pin.y - tee.y) || 1745;

        this.ball.launch({
          aimAngle: this.aimAngle,
          club: club,
          shotType: shotType,
          intentionalShape: 0,
          powerInput: shot.powerInput,
          snapError: shot.snapError,
          overswingPenalty: shot.overswingPenalty,
          terrainLie: terrainLie,
          slope: { x: 0, y: 0 },
          wind: this.wind,
          officialHoleMeters: officialMeters,
          mapTotalPixelLength: mapTotalPixelLength
        });

        this.sceneManager.recordStroke();

        if (shot.isPerfect) {
          this.hud.showSmashEffect();
        } else if (shot.snapError < -0.2) {
          this.hud.showShotPopup('HOOK!');
        } else if (shot.snapError > 0.2) {
          this.hud.showShotPopup('SLICE!');
        } else if (shot.isOverswing) {
          this.hud.showShotPopup('OVERSWING!');
        } else {
          this.hud.showShotPopup('SOLID CONTACT!');
        }
      };

      this.player.onSwingComplete = () => {
        this.closeSwingOverlay();
        this.state = GAME_STATES.BALL_FLIGHT;
      };

      this.switchHole(1);

      if (this.isPendingStart) {
        this.startGameFromTitle();
      }
    } catch (err) {
      console.error('Asset load error:', err);
    }
  }

  showTitleScreen() {
    this.state = GAME_STATES.TITLE_SCREEN;
    if (this.hud) this.hud.showTitleOverlay();
  }

  startGameFromTitle() {
    try {
      this.audioEngine.init();
      this.audioEngine.playMenuBeep();
    } catch (e) {
      console.warn('Audio Init Warning:', e);
    }

    if (!this.assetsLoaded) {
      this.isPendingStart = true;
      const startBtn = document.getElementById('btn-start-game');
      if (startBtn) startBtn.innerText = 'LOADING WARRAGUL COUNTRY CLUB...';
      return;
    }

    this.state = GAME_STATES.STRATEGY_AIM;
    if (this.hud) {
      this.hud.hideTitleOverlay();
      this.hud.hideBanner(); // Completely remove title banner from DOM/Canvas state!
    }
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.handleActionTrigger();
      } else if (e.code === 'ArrowLeft') {
        this.adjustAim(-0.05);
      } else if (e.code === 'ArrowRight') {
        this.adjustAim(0.05);
      } else if (e.code === 'ArrowUp') {
        this.changeClub(-1);
      } else if (e.code === 'ArrowDown') {
        this.changeClub(1);
      } else if (e.code === 'KeyS') {
        this.changeShotType(1);
      } else if (e.code === 'KeyM') {
        this.toggleFullOverview();
      } else if (e.code === 'Escape') {
        if (this.state === GAME_STATES.SWING_STAGE) {
          this.closeSwingOverlay();
        }
      } else if (e.code === 'KeyR') {
        this.resetCurrentShot();
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) this.switchHole(num);
      }
    });

    const onDragStart = (clientPos) => {
      if (this.state === GAME_STATES.STRATEGY_AIM) {
        if (this.isPuttingMode) {
          this.isDraggingPutt = true;
          this.dragStartPx = clientPos;
        } else {
          this.isDraggingMap = true;
          this.dragStartX = clientPos.x;
          this.dragStartY = clientPos.y;
        }
      }
    };

    const onDragMove = (clientPos) => {
      if (this.state === GAME_STATES.STRATEGY_AIM) {
        if (this.isDraggingPutt) {
          const dx = clientPos.x - this.dragStartPx.x;
          const dy = clientPos.y - this.dragStartPx.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 6) {
            this.aimAngle = Math.atan2(dy, dx);
            this.puttPower = Math.min(1.0, Math.max(0.05, dist / 110));
          }
        } else if (this.isDraggingMap) {
          const dx = clientPos.x - this.dragStartX;
          const dy = clientPos.y - this.dragStartY;
          this.camera.panBy(dx, dy);
          this.dragStartX = clientPos.x;
          this.dragStartY = clientPos.y;
        }
      }
    };

    const onDragEnd = () => {
      if (this.isDraggingPutt) {
        this.isDraggingPutt = false;
        if (this.puttPower > 0.12) {
          this.firePutt();
        }
      }
      this.isDraggingMap = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onDragStart({ x: e.clientX, y: e.clientY }));
    window.addEventListener('mousemove', (e) => onDragMove({ x: e.clientX, y: e.clientY }));
    window.addEventListener('mouseup', onDragEnd);

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        onDragMove({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    }, { passive: true });

    window.addEventListener('touchend', onDragEnd);

    const swingCanvas = document.getElementById('swing-canvas');
    if (swingCanvas) {
      swingCanvas.addEventListener('mousedown', () => {
        if (this.state === GAME_STATES.SWING_STAGE) {
          this.swingMeter.handleClick();
        }
      });
      swingCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === GAME_STATES.SWING_STAGE) {
          this.swingMeter.handleClick();
        }
      });
    }
  }

  openSwingOverlay() {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    this.audioEngine.init();

    const club = this.clubManager.getCurrentClub();
    if (this.isPuttingMode || club.isPutter) {
      this.handlePuttingClick();
      return;
    }

    this.state = GAME_STATES.SWING_STAGE;
    this.player.resetToAddress();
    this.swingMeter.reset();
    const shotType = this.clubManager.getCurrentShotType();
    this.swingMeter.setShotType(shotType);
    this.swingOverlay.show();
    this.hud.showBanner(`SWING STAGE: ${club.name}`, `${shotType.name} (${this.clubManager.getEffectiveDistance()}m)`, 2200);
  }

  closeSwingOverlay() {
    this.swingOverlay.hide();
    if (this.state === GAME_STATES.SWING_STAGE) {
      this.state = GAME_STATES.STRATEGY_AIM;
    }
  }

  /**
   * Dedicated 2-Click Putting Input Handler:
   * Click 1: Starts power meter oscillation.
   * Click 2: Locks power percentage, pauses 0.5s to show final locked bar, then executes putt physics.
   */
  handlePuttingClick() {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;

    // Debounce only guards against a single physical tap synthesizing two events
    // (e.g. touchstart + click) - it must stay well under normal human double-click
    // speed, or a real deliberate "click 1, click 2" putt gets silently swallowed
    // and puttingState gets stuck at CHARGING forever with the ball never firing.
    const now = performance.now();
    if (this.lastPuttingClickTime && (now - this.lastPuttingClickTime) < 60) {
      return;
    }
    this.lastPuttingClickTime = now;

    if (this.puttingState === PUTTING_STATES.IDLE) {
      // CLICK 1: Start power meter oscillation & unmount ON THE GREEN banner!
      this.puttingState = PUTTING_STATES.CHARGING;
      this.puttPower = 0.05;
      this.puttPowerDir = 1;
      if (this.hud) this.hud.hideBanner();
      this.audioEngine.playMenuBeep();
    } else if (this.puttingState === PUTTING_STATES.CHARGING) {
      // CLICK 2: Lock power percentage & pause 0.5s to display locked power bar!
      this.puttingState = PUTTING_STATES.EXECUTED;
      this.audioEngine.playMenuBeep();

      setTimeout(() => {
        this.firePutt();
      }, 500); // 0.5 second putting meter lock delay!
    }
  }

  firePutt() {
    this.audioEngine.init();
    const lockedPower = Math.min(1.0, Math.max(0.05, this.puttPower));
    this.puttPower = lockedPower;

    const club = this.clubManager.selectClubById('PUTTER');
    const shotType = this.clubManager.selectShotTypeById('FULL');

    const officialMeters = this.sceneManager.currentMetadata?.meters || 300;
    const tee = this.sceneManager.getTeePosition();
    const pin = this.sceneManager.getPinPosition();
    const mapTotalPixelLength = Math.hypot(pin.x - tee.x, pin.y - tee.y) || 1745;

    this.ball.launch({
      aimAngle: this.aimAngle,
      club: club,
      shotType: shotType,
      intentionalShape: 0,
      powerInput: lockedPower,
      snapError: 0,
      overswingPenalty: 0,
      terrainLie: { powerFactor: 1.0, loftFactor: 1.0 },
      slope: { x: 0, y: 0 },
      wind: { speed: 0, dirAngle: 0 },
      officialHoleMeters: officialMeters,
      mapTotalPixelLength: mapTotalPixelLength
    });

    this.sceneManager.recordStroke();
    this.audioEngine.playImpactSnap();
    this.audioEngine.playSwingWhoosh();
    this.state = GAME_STATES.BALL_FLIGHT;
  }

  handleActionTrigger() {
    this.audioEngine.init();

    if (this.state === GAME_STATES.TITLE_SCREEN) {
      this.startGameFromTitle();
    } else if (this.state === GAME_STATES.STRATEGY_AIM) {
      if (this.isPuttingMode || this.clubManager.getCurrentClub().isPutter) {
        this.handlePuttingClick();
      } else {
        this.openSwingOverlay();
        this.swingMeter.handleClick();
      }
    } else if (this.state === GAME_STATES.SWING_STAGE) {
      this.swingMeter.handleClick();
    } else if (this.state === GAME_STATES.HOLE_COMPLETE) {
      const nextHole = (this.sceneManager.currentHoleIndex % 9) + 1;
      this.switchHole(nextHole);
    }
  }

  switchHole(holeNum) {
    if (!this.sceneManager) return;
    const meta = this.sceneManager.loadHole(holeNum);
    this.camera.setMapBounds(meta.width, meta.height);

    const tee = this.sceneManager.getTeePosition();
    const pin = this.sceneManager.getPinPosition();

    this.player.setPosition(tee.x - 12, tee.y);
    this.ball.setPosition(tee.x, tee.y, 0);
    this.flagstick.setPosition(pin.x, pin.y);

    this.aimAngle = Math.atan2(pin.y - tee.y, pin.x - tee.x);
    this.player.setAimAngle(this.aimAngle);
    this.player.resetToAddress();

    this.swingMeter.reset();
    this.closeSwingOverlay();
    this.isPuttingMode = false;
    this.puttingState = PUTTING_STATES.IDLE;
    this.puttPower = 0.0;
    this.isRestingPauseActive = false;
    this.hud.setSwingButtonText('SWING');

    if (this.state !== GAME_STATES.TITLE_SCREEN) {
      this.state = GAME_STATES.STRATEGY_AIM;
    }

    this.wind = {
      speed: Math.floor(Math.random() * 10) + 2,
      dirAngle: Math.floor(Math.random() * 360)
    };

    this.camera.jumpTo(tee.x, tee.y, 0.85);

    const distMeters = this.sceneManager.calculateDistanceToPinInMeters(tee.x, tee.y);
    this.clubManager.autoSelectBestClub(distMeters, TERRAIN_TYPES.TEE_BOX);

    this.hud.updateHoleInfo(meta, distMeters, this.sceneManager.getScoreSummary());
    this.hud.updateClubInfo(this.clubManager.getCurrentClub(), this.clubManager.getEffectiveDistance());
    this.hud.updateShotTypeInfo(this.clubManager.getCurrentShotType());
    this.hud.updateWind(this.wind.speed, this.wind.dirAngle);
    this.hud.showBanner(`HOLE ${meta.hole}: WARRAGUL COUNTRY CLUB`, `PAR ${meta.par} - ${meta.meters || distMeters}m`, 2500);
  }

  adjustAim(deltaAngle) {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    this.aimAngle += deltaAngle;
    this.player.setAimAngle(this.aimAngle);
  }

  changeClub(dir) {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    const club = dir > 0 ? this.clubManager.nextClub() : this.clubManager.prevClub();
    this.isPuttingMode = club.isPutter;
    this.puttingState = PUTTING_STATES.IDLE;
    this.puttPower = 0.0;
    this.hud.setSwingButtonText(this.isPuttingMode ? 'PUTT' : 'SWING');
    this.hud.updateClubInfo(club, this.clubManager.getEffectiveDistance());
    this.audioEngine.playMenuBeep();
  }

  changeShotType(dir) {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    const shotType = dir > 0 ? this.clubManager.nextShotType() : this.clubManager.prevShotType();
    this.hud.updateShotTypeInfo(shotType);
    this.hud.updateClubInfo(this.clubManager.getCurrentClub(), this.clubManager.getEffectiveDistance());
    this.audioEngine.playMenuBeep();
  }

  toggleFullOverview() {
    return this.camera.toggleFullOverview();
  }

  resetCurrentShot() {
    if (!this.sceneManager) return;
    const tee = this.sceneManager.getTeePosition();
    this.ball.setPosition(tee.x, tee.y, 0);
    this.player.setPosition(tee.x - 12, tee.y);
    this.player.resetToAddress();
    this.swingMeter.reset();
    this.closeSwingOverlay();
    this.isPuttingMode = false;
    this.puttingState = PUTTING_STATES.IDLE;
    this.puttPower = 0.0;
    this.isRestingPauseActive = false;
    this.hud.setSwingButtonText('SWING');
    this.state = GAME_STATES.STRATEGY_AIM;
  }

  processBallLandingRest() {
    if (!this.sceneManager) return;

    if (this.ball.inHazard) {
      this.hud.showBanner('WATER HAZARD!', '+1 PENALTY STROKE', 2500);
      setTimeout(() => this.resetCurrentShot(), 1200);
      return;
    }

    const par = this.sceneManager.currentMetadata?.par || 4;
    const maxStrokes = par * 2;
    if (this.sceneManager.currentHoleStrokes >= maxStrokes) {
      this.audioEngine.playMenuBeep();
      this.state = GAME_STATES.HOLE_COMPLETE;
      this.hud.showBanner('DOUBLE PAR LIMIT REACHED', `HOLE COMPLETED IN ${maxStrokes} STROKES`, 3000);
      return;
    }

    this.player.setPosition(this.ball.x - 12, this.ball.y);
    const pin = this.sceneManager.getPinPosition();
    this.aimAngle = Math.atan2(pin.y - this.ball.y, pin.x - this.ball.x);
    this.player.setAimAngle(this.aimAngle);
    this.player.resetToAddress();
    this.swingMeter.reset();
    this.state = GAME_STATES.STRATEGY_AIM;

    const remainingDist = this.sceneManager.calculateDistanceToPinInMeters(this.ball.x, this.ball.y);

    if (this.ball.currentTerrain.id === 'GREEN' || remainingDist <= 12) {
      this.isPuttingMode = true;
      this.puttingState = PUTTING_STATES.IDLE;
      this.puttPower = 0.0;
      this.swingOverlay.hide();
      this.clubManager.selectClubById('PUTTER');
      this.clubManager.selectShotTypeById('FULL');
      this.hud.updateClubInfo(this.clubManager.getCurrentClub(), this.clubManager.getEffectiveDistance());
      this.hud.updateShotTypeInfo(this.clubManager.getCurrentShotType());
      this.hud.setSwingButtonText('PUTT');
      this.hud.showBanner('ON THE GREEN!', 'USE TOP-DOWN PUTTING VIEW TO HOLE IN', 2500);
    } else {
      this.isPuttingMode = false;
      this.puttingState = PUTTING_STATES.IDLE;
      this.puttPower = 0.0;
      this.hud.setSwingButtonText('SWING');
      const recommended = this.clubManager.autoSelectBestClub(remainingDist, this.ball.currentTerrain);
      this.hud.updateClubInfo(recommended.club, this.clubManager.getEffectiveDistance());
      this.hud.updateShotTypeInfo(recommended.shotType);
      this.hud.showShotPopup(`CADDIE: ${recommended.club.name} AUTO-SELECTED`, 2200);
    }
  }

  update() {
    if (this.state === GAME_STATES.SWING_STAGE) {
      this.swingMeter.update();
      this.swingOverlay.updateMeterUI(this.swingMeter);
      this.player.update();
    }

    if (this.puttingState === PUTTING_STATES.CHARGING && this.state === GAME_STATES.STRATEGY_AIM) {
      this.puttPower += 0.018 * this.puttPowerDir;
      if (this.puttPower >= 1.0) {
        this.puttPower = 1.0;
        this.puttPowerDir = -1;
      } else if (this.puttPower <= 0.05) {
        this.puttPower = 0.05;
        this.puttPowerDir = 1;
      }
    }

    if (this.sceneManager && (this.state === GAME_STATES.BALL_FLIGHT || this.ball.isRolling)) {
      this.ball.update(
        (x, y) => this.sceneManager.sampleTerrainPixel(x, y),
        this.wind,
        this.audioEngine
      );

      this.camera.setTarget(this.ball.x, this.ball.y, 0.95);

      // Hole Completion ONLY triggers when ball enters cup radius on green!
      if (this.flagstick.checkBallInCup(this.ball)) {
        this.audioEngine.playCupSink();
        this.state = GAME_STATES.HOLE_COMPLETE;
        this.hud.showBanner('HOLE COMPLETE!', 'PRESS SPACE FOR NEXT HOLE', 0);
      }

      // Forced 1.5-second Ball Landing Pause sitting on the resting ball!
      if (!this.ball.inAir && !this.ball.isRolling && !this.ball.isHoled && !this.isRestingPauseActive) {
        this.isRestingPauseActive = true;
        setTimeout(() => {
          this.isRestingPauseActive = false;
          this.processBallLandingRest();
        }, 1500); // 1.5 second landing pause!
      }
    } else if (this.sceneManager && this.state === GAME_STATES.STRATEGY_AIM && !this.camera.isManualPanning) {
      if (this.isPuttingMode) {
        // Zoom camera in close to 2.5x centered on midpoint between ball and cup!
        const pin = this.sceneManager.getPinPosition();
        const centerX = (this.ball.x + pin.x) / 2;
        const centerY = (this.ball.y + pin.y) / 2;
        this.camera.setTarget(centerX, centerY, 2.5);
      } else {
        const club = this.clubManager.getCurrentClub();
        const effDist = this.clubManager.getEffectiveDistance();
        const officialMeters = this.sceneManager.currentMetadata?.meters || 300;
        const tee = this.sceneManager.getTeePosition();
        const pin = this.sceneManager.getPinPosition();
        const mapTotalPixelLength = Math.hypot(pin.x - tee.x, pin.y - tee.y) || 1745;
        const pixelsPerMeter = mapTotalPixelLength / officialMeters;

        const targetDist = effDist * pixelsPerMeter;
        const targetX = this.ball.x + Math.cos(this.aimAngle) * targetDist;
        const targetY = this.ball.y + Math.sin(this.aimAngle) * targetDist;
        this.camera.setAimTarget(this.ball.x, this.ball.y, targetX, targetY);
      }
    }

    this.camera.update();

    if (this.sceneManager) {
      const distMeters = this.sceneManager.calculateDistanceToPinInMeters(this.ball.x, this.ball.y);
      this.hud.updateHoleInfo(this.sceneManager.currentMetadata, distMeters, this.sceneManager.getScoreSummary());
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.camera.applyTransform(this.ctx);

    if (this.sceneManager) {
      this.sceneManager.renderMap(this.ctx);
      this.flagstick.render(this.ctx);

      if (this.state === GAME_STATES.STRATEGY_AIM) {
        const officialMeters = this.sceneManager.currentMetadata?.meters || 300;
        const tee = this.sceneManager.getTeePosition();
        const pin = this.sceneManager.getPinPosition();
        const mapTotalPixelLength = Math.hypot(pin.x - tee.x, pin.y - tee.y) || 1745;
        const pixelsPerMeter = mapTotalPixelLength / officialMeters;

        if (this.isPuttingMode) {
          // 1. Render Clear Dotted Aiming Line directly from Ball to Cup
          this.ctx.strokeStyle = 'rgba(0, 230, 118, 0.55)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 5]);
          this.ctx.beginPath();
          this.ctx.moveTo(this.ball.x, this.ball.y);
          this.ctx.lineTo(pin.x, pin.y);
          this.ctx.stroke();
          this.ctx.setLineDash([]);

          // 2. Contour & Grid Lines
          this.ctx.strokeStyle = 'rgba(0, 230, 118, 0.30)';
          this.ctx.lineWidth = 1;
          for (let m = 2; m <= 12; m += 2) {
            this.ctx.beginPath();
            this.ctx.arc(pin.x, pin.y, m * pixelsPerMeter, 0, Math.PI * 2);
            this.ctx.stroke();
          }

          // 3. Active Putter Power Aim Line & Target Point (Hard 15m cap)
          const maxPuttDistMeters = 15;
          const maxPuttPixels = maxPuttDistMeters * pixelsPerMeter;
          const currentPuttPixels = maxPuttPixels * (this.puttPower || 0.05);

          const targetX = this.ball.x + Math.cos(this.aimAngle) * currentPuttPixels;
          const targetY = this.ball.y + Math.sin(this.aimAngle) * currentPuttPixels;

          this.ctx.strokeStyle = '#ffea00';
          this.ctx.lineWidth = 3.5;
          this.ctx.beginPath();
          this.ctx.moveTo(this.ball.x, this.ball.y);
          this.ctx.lineTo(targetX, targetY);
          this.ctx.stroke();

          this.ctx.fillStyle = '#00e676';
          this.ctx.beginPath();
          this.ctx.arc(targetX, targetY, 5, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
        } else {
          // Standard Full Aim Arrow
          const club = this.clubManager.getCurrentClub();
          const effDist = this.clubManager.getEffectiveDistance();
          const targetDist = effDist * pixelsPerMeter;
          const targetX = this.ball.x + Math.cos(this.aimAngle) * targetDist;
          const targetY = this.ball.y + Math.sin(this.aimAngle) * targetDist;

          this.ctx.strokeStyle = 'rgba(255, 235, 59, 0.85)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([6, 6]);
          this.ctx.beginPath();
          this.ctx.moveTo(this.ball.x, this.ball.y);
          this.ctx.lineTo(targetX, targetY);
          this.ctx.stroke();
          this.ctx.setLineDash([]);

          this.ctx.strokeStyle = '#00e676';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(targetX, targetY, 14, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.fillStyle = 'rgba(0, 230, 118, 0.25)';
          this.ctx.fill();
        }
      }

      this.ball.render(this.ctx);
    }

    this.camera.restoreTransform(this.ctx);

    // Untransformed Canvas HUD Layer (Linear Putting Power Bar)
    if (this.state === GAME_STATES.STRATEGY_AIM && this.isPuttingMode) {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const barW = 240;
      const barH = 20;
      const barX = (w - barW) / 2;
      const barY = h - 95;

      this.ctx.save();

      this.ctx.fillStyle = 'rgba(10, 18, 36, 0.92)';
      this.ctx.strokeStyle = '#00e676';
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(barX - 10, barY - 26, barW + 20, barH + 34);
      this.ctx.strokeRect(barX - 10, barY - 26, barW + 20, barH + 34);

      this.ctx.font = '700 9px "Press Start 2P", monospace';
      this.ctx.fillStyle = '#ffea00';
      this.ctx.textAlign = 'center';
      const puttMeters = Math.round(25 * (this.puttPower || 0.05));

      let hintText = `PUTT POWER: ${Math.round(this.puttPower * 100)}% (${puttMeters}m)`;
      if (this.puttingState === PUTTING_STATES.IDLE) {
        hintText = 'CLICK 1: START PUTT METER';
      } else if (this.puttingState === PUTTING_STATES.CHARGING) {
        hintText = `CLICK 2: LOCK POWER (${Math.round(this.puttPower * 100)}%)`;
      }
      this.ctx.fillText(hintText, w / 2, barY - 8);

      this.ctx.fillStyle = '#101626';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(barX, barY, barW, barH);
      this.ctx.strokeRect(barX, barY, barW, barH);

      this.ctx.fillStyle = (this.puttingState === PUTTING_STATES.CHARGING) ? '#00e676' : '#ffea00';
      this.ctx.fillRect(barX, barY, barW * this.puttPower, barH);

      this.ctx.restore();
    }

    if (this.state === GAME_STATES.SWING_STAGE) {
      const spriteSheet = this.assetLoader.getSophieSpriteSheet();
      const spriteMeta = this.assetLoader.getSpriteMetadata();
      this.swingOverlay.render(this.player, spriteSheet, spriteMeta, this.swingMeter);
    }
  }

  loop(timestamp) {
    this.update();
    this.render();
    requestAnimationFrame((ts) => this.loop(ts));
  }
}
