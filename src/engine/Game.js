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

    // Core Systems
    this.assetLoader = new AssetLoader();
    this.sceneManager = null;
    this.camera = new Camera(640, 480);
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
    this.aimDistance = 240;

    // Control flags
    this.isDraggingAim = false;
  }

  async boot() {
    // 1. Load assets (with 16-bit procedural fallbacks)
    await this.assetLoader.loadAllAssets();

    // 2. Initialize Scene Manager & HUD
    this.sceneManager = new SceneManager(this.assetLoader);
    this.hud = new HUD(this);

    // 3. Setup Swing Meter Callbacks
    this.swingMeter.onStateChange = (meterState) => {
      this.audioEngine.playMenuBeep();
      if (meterState === SWING_STATES.POWER_GAUGE) {
        // Trigger Sophie Backswing animation start!
        this.player.startSwingAnimation();
        this.state = GAME_STATES.SWINGING;
      }
    };

    this.swingMeter.onShotTriggered = (shotResult) => {
      // Calculated shot parameters
      this.pendingShot = shotResult;
    };

    // 4. Setup Sophie Player Controller Callbacks
    this.player.onImpactFrame = () => {
      // Triggered at exact impact frame of Sophie's swing!
      this.audioEngine.playImpactSnap();
      this.audioEngine.playSwingWhoosh();

      const club = this.clubManager.getCurrentClub();
      const shot = this.pendingShot || { power: 1.0, snap: 0.0, isPerfect: true };

      // Launch Ball Physics
      this.ball.launch(shot.power, this.aimAngle, club, shot.snap, this.wind);
      this.sceneManager.recordStroke();
      this.state = GAME_STATES.BALL_IN_FLIGHT;

      // Show accuracy result popup
      if (shot.isPerfect) {
        this.hud.showShotPopup('PERFECT SNAP!!');
      } else if (shot.snap < -0.3) {
        this.hud.showShotPopup('HOOK SHOT!');
      } else if (shot.snap > 0.3) {
        this.hud.showShotPopup('SLICE SHOT!');
      } else {
        this.hud.showShotPopup('GOOD HIT!');
      }
    };

    // 5. Register Keyboard & Mouse Inputs
    this.setupInputs();

    // 6. Load Hole 1
    this.switchHole(1);

    // 7. Start Game Loop
    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  setupInputs() {
    // Keyboard listener
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.handleActionTrigger();
      } else if (e.code === 'ArrowLeft') {
        this.adjustAim(-0.06);
      } else if (e.code === 'ArrowRight') {
        this.adjustAim(0.06);
      } else if (e.code === 'ArrowUp') {
        this.changeClub(-1);
      } else if (e.code === 'ArrowDown') {
        this.changeClub(1);
      } else if (e.code === 'KeyR') {
        this.resetCurrentShot();
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) this.switchHole(num);
      }
    });

    // Canvas click & mouse aim drag listener
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state === GAME_STATES.AIMING) {
        this.handleActionTrigger();
      }
    });
  }

  handleActionTrigger() {
    this.audioEngine.init();

    if (this.state === GAME_STATES.AIMING || this.state === GAME_STATES.SWINGING) {
      this.swingMeter.handleClick();
    } else if (this.state === GAME_STATES.HOLE_COMPLETE) {
      // Advance to next hole
      const nextHole = (this.sceneManager.currentHoleIndex % 9) + 1;
      this.switchHole(nextHole);
    }
  }

  switchHole(holeNum) {
    const meta = this.sceneManager.loadHole(holeNum);
    this.camera.setMapBounds(meta.width, meta.height);

    const tee = this.sceneManager.getTeePosition();
    const pin = this.sceneManager.getPinPosition();

    // Reset Player, Ball, and Flagstick
    this.player.setPosition(tee.x - 12, tee.y);
    this.ball.setPosition(tee.x, tee.y, 0);
    this.flagstick.setPosition(pin.x, pin.y);

    // Orient aim towards pin
    this.aimAngle = Math.atan2(pin.y - tee.y, pin.x - tee.x);
    this.player.setAimAngle(this.aimAngle);
    this.player.resetToAddress();

    // Reset Swing Meter & State
    this.swingMeter.reset();
    this.state = GAME_STATES.AIMING;

    // Randomize Wind
    this.wind = {
      speed: Math.floor(Math.random() * 12) + 2,
      dirAngle: Math.floor(Math.random() * 360)
    };

    // Camera jump to tee
    this.camera.jumpTo(tee.x, tee.y);

    // Update HUD
    this.hud.updateHoleInfo(meta, this.sceneManager.calculateDistanceToPinInYards(this.ball.x, this.ball.y), this.sceneManager.getScoreSummary());
    this.hud.updateClubInfo(this.clubManager.getCurrentClub());
    this.hud.updateWind(this.wind.speed, this.wind.dirAngle);
    this.hud.showBanner(`HOLE ${meta.hole}: ${meta.name.toUpperCase()}`, `PAR ${meta.par} - ${meta.width > 0 ? this.sceneManager.calculateDistanceToPinInYards(tee.x, tee.y) : 380} YDS`);
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

  resetCurrentShot() {
    const tee = this.sceneManager.getTeePosition();
    this.ball.setPosition(tee.x, tee.y, 0);
    this.player.setPosition(tee.x - 12, tee.y);
    this.player.resetToAddress();
    this.swingMeter.reset();
    this.state = GAME_STATES.AIMING;
    this.camera.setTarget(tee.x, tee.y);
  }

  update() {
    // 1. Update Swing Meter
    this.swingMeter.update();
    this.hud.updateSwingMeter(this.swingMeter);

    // 2. Update Sophie Player Controller
    this.player.update();

    // 3. Update Ball Physics
    if (this.state === GAME_STATES.BALL_IN_FLIGHT || this.ball.isRolling) {
      this.ball.update(
        (x, y) => this.sceneManager.sampleTerrainPixel(x, y),
        this.wind,
        this.audioEngine
      );

      // Camera smooth tracks ball during flight
      this.camera.setTarget(this.ball.x, this.ball.y);

      // Check Flagstick / Cup Sink
      if (this.flagstick.checkBallInCup(this.ball)) {
        this.audioEngine.playCupSink();
        this.state = GAME_STATES.HOLE_COMPLETE;
        this.hud.showBanner('HOLE IN ONE! / HOLE COMPLETE!', 'PRESS SPACE FOR NEXT HOLE', 0);
      }

      // Check if Ball Stopped Rolling
      if (!this.ball.inAir && !this.ball.isRolling && !this.ball.isHoled) {
        if (this.ball.inHazard) {
          // Reset to previous tee/shot location
          this.hud.showBanner('WATER HAZARD!', '+1 PENALTY STROKE', 2500);
          setTimeout(() => this.resetCurrentShot(), 1200);
        } else {
          // Ball stopped on turf -> Move Sophie up to ball for next shot!
          this.player.setPosition(this.ball.x - 12, this.ball.y);
          const pin = this.sceneManager.getPinPosition();
          this.aimAngle = Math.atan2(pin.y - this.ball.y, pin.x - this.ball.x);
          this.player.setAimAngle(this.aimAngle);
          this.player.resetToAddress();
          this.swingMeter.reset();
          this.state = GAME_STATES.AIMING;

          // Auto select Putter if on Green!
          if (this.ball.currentTerrain.id === 'GREEN') {
            this.clubManager.selectClubById('PUTTER');
            this.hud.updateClubInfo(this.clubManager.getCurrentClub());
          }
        }
      }
    } else if (this.state === GAME_STATES.AIMING) {
      this.camera.setTarget(this.ball.x, this.ball.y);
    }

    // 4. Update Camera Panning
    this.camera.update();

    // 5. Update HUD Distance readout
    const distYards = this.sceneManager.calculateDistanceToPinInYards(this.ball.x, this.ball.y);
    this.hud.updateHoleInfo(this.sceneManager.currentMetadata, distYards, this.sceneManager.getScoreSummary());
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply 2D Camera Transform
    this.camera.applyTransform(this.ctx);

    // 1. Render 16-Bit Top-Down Golf Hole Map
    this.sceneManager.renderMap(this.ctx);

    // 2. Render Flagstick Pin & Hole Cup
    this.flagstick.render(this.ctx);

    // 3. Render Aim Target Line (When Aiming)
    if (this.state === GAME_STATES.AIMING) {
      const club = this.clubManager.getCurrentClub();
      const targetDist = club.maxDistance * 2.2;
      const targetX = this.ball.x + Math.cos(this.aimAngle) * targetDist;
      const targetY = this.ball.y + Math.sin(this.aimAngle) * targetDist;

      // Dashed Aim Vector
      this.ctx.strokeStyle = 'rgba(255, 235, 59, 0.75)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.ball.x, this.ball.y);
      this.ctx.lineTo(targetX, targetY);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Landing Target Circle
      this.ctx.strokeStyle = '#00e676';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(targetX, targetY, 12, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // 4. Render Sophie Player Character Sprite
    const spriteSheet = this.assetLoader.getSophieSpriteSheet();
    const spriteMeta = this.assetLoader.getSpriteMetadata();
    this.player.render(this.ctx, spriteSheet, spriteMeta);

    // 5. Render Golf Ball & 3D Flight Shadow
    this.ball.render(this.ctx);

    // Restore Camera Transform
    this.camera.restoreTransform(this.ctx);
  }

  loop(timestamp) {
    this.update();
    this.render();
    requestAnimationFrame((ts) => this.loop(ts));
  }
}
