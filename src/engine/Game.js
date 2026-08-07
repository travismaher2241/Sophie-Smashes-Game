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

    // Shot aim properties
    this.aimAngle = -Math.PI / 2;

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
          // CLICK 1: Start backswing (Frame 2)
          this.player.startBackswing();
        } else if (meterState === SWING_STATES.SNAP_GAUGE) {
          // CLICK 2: Lock power & reach top of backswing (Frame 3)
          this.player.reachTop();
        } else if (meterState === SWING_STATES.COMPLETE) {
          // CLICK 3: Lock accuracy & fire downswing (Frame 4 / Impact)
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
        // Immediately hide side-view swing overlay and cut to top-down camera tracking ball flight!
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
      this.hud.showBanner('WELCOME TO SOPHIE SMASHES!', 'WARRAGUL COUNTRY CLUB - HOLE 1', 3000);
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
        this.isDraggingMap = true;
        this.dragStartX = clientPos.x;
        this.dragStartY = clientPos.y;
      }
    };

    const onDragMove = (clientPos) => {
      if (this.isDraggingMap && this.state === GAME_STATES.STRATEGY_AIM) {
        const dx = clientPos.x - this.dragStartX;
        const dy = clientPos.y - this.dragStartY;
        this.camera.panBy(dx, dy);
        this.dragStartX = clientPos.x;
        this.dragStartY = clientPos.y;
      }
    };

    const onDragEnd = () => {
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
    this.state = GAME_STATES.SWING_STAGE;
    this.player.resetToAddress();
    this.swingMeter.reset();
    const club = this.clubManager.getCurrentClub();
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

  handleActionTrigger() {
    this.audioEngine.init();

    if (this.state === GAME_STATES.TITLE_SCREEN) {
      this.startGameFromTitle();
    } else if (this.state === GAME_STATES.STRATEGY_AIM) {
      this.openSwingOverlay();
      this.swingMeter.handleClick();
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
    
    if (this.state !== GAME_STATES.TITLE_SCREEN) {
      this.state = GAME_STATES.STRATEGY_AIM;
    }

    this.wind = {
      speed: Math.floor(Math.random() * 10) + 2,
      dirAngle: Math.floor(Math.random() * 360)
    };

    this.camera.jumpTo(tee.x, tee.y, 0.85);

    const distMeters = this.sceneManager.calculateDistanceToPinInMeters(tee.x, tee.y);

    // Auto-select optimal club & shot mode for this hole/shot!
    this.clubManager.autoSelectBestClub(distMeters, TERRAIN_TYPES.TEE_BOX);

    this.hud.updateHoleInfo(meta, distMeters, this.sceneManager.getScoreSummary());
    this.hud.updateClubInfo(this.clubManager.getCurrentClub(), this.clubManager.getEffectiveDistance());
    this.hud.updateShotTypeInfo(this.clubManager.getCurrentShotType());
    this.hud.updateWind(this.wind.speed, this.wind.dirAngle);
    this.hud.showBanner(`HOLE ${meta.hole}: WARRAGUL COUNTRY CLUB`, `PAR ${meta.par} - ${meta.meters || distMeters}m`);
  }

  adjustAim(deltaAngle) {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    this.aimAngle += deltaAngle;
    this.player.setAimAngle(this.aimAngle);
  }

  changeClub(dir) {
    if (this.state !== GAME_STATES.STRATEGY_AIM) return;
    const club = dir > 0 ? this.clubManager.nextClub() : this.clubManager.prevClub();
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
    this.state = GAME_STATES.STRATEGY_AIM;
  }

  update() {
    if (this.state === GAME_STATES.SWING_STAGE) {
      this.swingMeter.update();
      this.swingOverlay.updateMeterUI(this.swingMeter);
      this.player.update();
    }

    if (this.sceneManager && (this.state === GAME_STATES.BALL_FLIGHT || this.ball.isRolling)) {
      this.ball.update(
        (x, y) => this.sceneManager.sampleTerrainPixel(x, y),
        this.wind,
        this.audioEngine
      );

      this.camera.setTarget(this.ball.x, this.ball.y, 0.95);

      if (this.flagstick.checkBallInCup(this.ball)) {
        this.audioEngine.playCupSink();
        this.state = GAME_STATES.HOLE_COMPLETE;
        this.hud.showBanner('HOLE COMPLETE!', 'PRESS SPACE FOR NEXT HOLE', 0);
      }

      if (!this.ball.inAir && !this.ball.isRolling && !this.ball.isHoled) {
        if (this.ball.inHazard) {
          this.hud.showBanner('WATER HAZARD!', '+1 PENALTY STROKE', 2500);
          setTimeout(() => this.resetCurrentShot(), 1200);
        } else {
          this.player.setPosition(this.ball.x - 12, this.ball.y);
          const pin = this.sceneManager.getPinPosition();
          this.aimAngle = Math.atan2(pin.y - this.ball.y, pin.x - this.ball.x);
          this.player.setAimAngle(this.aimAngle);
          this.player.resetToAddress();
          this.swingMeter.reset();
          this.state = GAME_STATES.STRATEGY_AIM;

          // Smart Caddie Auto-Select best club & shot mode for next shot!
          const remainingDist = this.sceneManager.calculateDistanceToPinInMeters(this.ball.x, this.ball.y);
          const recommended = this.clubManager.autoSelectBestClub(remainingDist, this.ball.currentTerrain);

          this.hud.updateClubInfo(recommended.club, this.clubManager.getEffectiveDistance());
          this.hud.updateShotTypeInfo(recommended.shotType);
          this.hud.showShotPopup(`CADDIE: ${recommended.club.name} AUTO-SELECTED`, 1800);
        }
      }
    } else if (this.sceneManager && this.state === GAME_STATES.STRATEGY_AIM && !this.camera.isManualPanning) {
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

      this.ball.render(this.ctx);
    }

    this.camera.restoreTransform(this.ctx);

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
