import { AssetLoader } from './AssetLoader.js';
import { SceneManager } from './SceneManager.js';
import { Camera } from './Camera.js';
import { AudioEngine } from './AudioEngine.js';
import { PlayerController } from '../entities/PlayerController.js';
import { BallPhysics } from '../entities/BallPhysics.js';
import { Flagstick } from '../entities/Flagstick.js';
import { ClubManager } from '../mechanics/Clubs.js';
import { SwingMeter, SWING_STATES } from '../mechanics/SwingMeter.js';
import { HUD } from '../ui/HUD.js';

export const GAME_STATES = {
  AIMING: 'AIMING',
  SWINGING: 'SWINGING',
  BALL_IN_FLIGHT: 'BALL_IN_FLIGHT',
  BALL_STOPPED: 'BALL_STOPPED',
  HOLE_COMPLETE: 'HOLE_COMPLETE'
};

export class Game {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Canvas resolution setup (800x600 widescreen retro ratio)
    this.canvas.width = 800;
    this.canvas.height = 600;

    // Core Systems
    this.assetLoader = new AssetLoader();
    this.sceneManager = null;
    this.camera = new Camera(800, 600);
    this.audioEngine = new AudioEngine();
    this.clubManager = new ClubManager();
    this.swingMeter = new SwingMeter();

    // Entities
    this.player = new PlayerController();
    this.ball = new BallPhysics();
    this.flagstick = new Flagstick();

    // UI
    this.hud = null;

    // Game state
    this.state = GAME_STATES.AIMING;
    this.wind = { speed: 6, dirAngle: 45 };

    // Shot aim properties
    this.aimAngle = -Math.PI / 2; // Facing north toward green by default
  }

  async boot() {
    // 1. Load assets
    await this.assetLoader.loadAllAssets();

    // 2. Initialize Scene Manager & HUD
    this.sceneManager = new SceneManager(this.assetLoader);
    this.hud = new HUD(this);

    // 3. Setup Swing Meter Callbacks (Links LS 98 Style 3-Click)
    this.swingMeter.onStateChange = (meterState) => {
      this.audioEngine.playMenuBeep();
      if (meterState === SWING_STATES.POWER_GAUGE) {
        this.player.startSwingAnimation();
        this.state = GAME_STATES.SWINGING;
      }
    };

    this.swingMeter.onShotTriggered = (shotResult) => {
      this.pendingShot = shotResult;
    };

    // 4. Setup Player Impact Callback
    this.player.onImpactFrame = () => {
      this.audioEngine.playImpactSnap();
      this.audioEngine.playSwingWhoosh();

      const club = this.clubManager.getCurrentClub();
      const shot = this.pendingShot || { power: 1.0, snap: 0.0, isPerfect: true };

      this.ball.launch(shot.power, this.aimAngle, club, shot.snap, this.wind);
      this.sceneManager.recordStroke();
      this.state = GAME_STATES.BALL_IN_FLIGHT;

      if (shot.isPerfect) {
        this.hud.showShotPopup('PERFECT SNAP!!');
      } else if (shot.snap < -0.2) {
        this.hud.showShotPopup('HOOK SHOT!');
      } else if (shot.snap > 0.2) {
        this.hud.showShotPopup('SLICE SHOT!');
      } else {
        this.hud.showShotPopup('GOOD HIT!');
      }
    };

    // 5. Register Inputs
    this.setupInputs();

    // 6. Load Hole 1
    this.switchHole(1);

    // 7. Start Game Loop
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
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
      } else if (e.code === 'KeyM') {
        this.toggleFullOverview();
      } else if (e.code === 'KeyR') {
        this.resetCurrentShot();
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) this.switchHole(num);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === GAME_STATES.AIMING || this.state === GAME_STATES.SWINGING) {
        this.handleActionTrigger();
      }
    });
  }

  handleActionTrigger() {
    this.audioEngine.init();

    if (this.state === GAME_STATES.AIMING || this.state === GAME_STATES.SWINGING) {
      this.swingMeter.handleClick();
    } else if (this.state === GAME_STATES.HOLE_COMPLETE) {
      const nextHole = (this.sceneManager.currentHoleIndex % 9) + 1;
      this.switchHole(nextHole);
    }
  }

  switchHole(holeNum) {
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
    this.state = GAME_STATES.AIMING;

    this.wind = {
      speed: Math.floor(Math.random() * 10) + 2,
      dirAngle: Math.floor(Math.random() * 360)
    };

    const club = this.clubManager.getCurrentClub();
    const targetDist = club.maxDistance * 2.2;
    const targetX = tee.x + Math.cos(this.aimAngle) * targetDist;
    const targetY = tee.y + Math.sin(this.aimAngle) * targetDist;
    this.camera.setAimTarget(tee.x, tee.y, targetX, targetY);

    const distMeters = this.sceneManager.calculateDistanceToPinInMeters(tee.x, tee.y);
    this.hud.updateHoleInfo(meta, distMeters, this.sceneManager.getScoreSummary());
    this.hud.updateClubInfo(this.clubManager.getCurrentClub());
    this.hud.updateWind(this.wind.speed, this.wind.dirAngle);
    this.hud.showBanner(`HOLE ${meta.hole}: WARRAGUL COUNTRY CLUB`, `PAR ${meta.par} - ${meta.meters || distMeters}m`);
  }

  adjustAim(deltaAngle) {
    if (this.state !== GAME_STATES.AIMING) return;
    this.aimAngle += deltaAngle;
    this.player.setAimAngle(this.aimAngle);
  }

  changeClub(dir) {
    if (this.state !== GAME_STATES.AIMING) return;
    const club = dir > 0 ? this.clubManager.nextClub() : this.clubManager.prevClub();
    this.hud.updateClubInfo(club);
    this.audioEngine.playMenuBeep();
  }

  toggleFullOverview() {
    return this.camera.toggleFullOverview();
  }

  resetCurrentShot() {
    const tee = this.sceneManager.getTeePosition();
    this.ball.setPosition(tee.x, tee.y, 0);
    this.player.setPosition(tee.x - 12, tee.y);
    this.player.resetToAddress();
    this.swingMeter.reset();
    this.state = GAME_STATES.AIMING;
  }

  update() {
    this.swingMeter.update();
    this.hud.updateSwingMeter(this.swingMeter);
    this.player.update();

    if (this.state === GAME_STATES.BALL_IN_FLIGHT || this.ball.isRolling) {
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
          this.state = GAME_STATES.AIMING;

          if (this.ball.currentTerrain.id === 'GREEN') {
            this.clubManager.selectClubById('PUTTER');
            this.hud.updateClubInfo(this.clubManager.getCurrentClub());
          }
        }
      }
    } else if (this.state === GAME_STATES.AIMING) {
      const club = this.clubManager.getCurrentClub();
      const targetDist = club.maxDistance * 2.2;
      const targetX = this.ball.x + Math.cos(this.aimAngle) * targetDist;
      const targetY = this.ball.y + Math.sin(this.aimAngle) * targetDist;
      this.camera.setAimTarget(this.ball.x, this.ball.y, targetX, targetY);
    }

    this.camera.update();

    const distMeters = this.sceneManager.calculateDistanceToPinInMeters(this.ball.x, this.ball.y);
    this.hud.updateHoleInfo(this.sceneManager.currentMetadata, distMeters, this.sceneManager.getScoreSummary());
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.camera.applyTransform(this.ctx);

    this.sceneManager.renderMap(this.ctx);
    this.flagstick.render(this.ctx);

    if (this.state === GAME_STATES.AIMING) {
      const club = this.clubManager.getCurrentClub();
      const targetDist = club.maxDistance * 2.2;
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

    const spriteSheet = this.assetLoader.getSophieSpriteSheet();
    const spriteMeta = this.assetLoader.getSpriteMetadata();
    this.player.render(this.ctx, spriteSheet, spriteMeta);

    this.ball.render(this.ctx);

    this.camera.restoreTransform(this.ctx);
  }

  loop(timestamp) {
    this.update();
    this.render();
    requestAnimationFrame((ts) => this.loop(ts));
  }
}
