/**
 * 16-Bit Flagstick Pin & Hole Cup Entity
 */
export class Flagstick {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.cupRadius = 7;
    this.waveTimer = 0;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  checkBallInCup(ball) {
    if (ball.z > 8) return false; // Ball flying too high over pin

    const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
    const ballSpeed = Math.hypot(ball.vx, ball.vy);

    // If ball speed is reasonable and close to cup center -> HOLE IN!
    if (dist < this.cupRadius && ballSpeed < 6.5) {
      ball.x = this.x;
      ball.y = this.y;
      ball.z = 0;
      ball.vx = 0;
      ball.vy = 0;
      ball.isHoled = true;
      ball.isRolling = false;
      ball.inAir = false;
      return true;
    }
    return false;
  }

  render(ctx) {
    this.waveTimer += 0.08;
    const waveOffset = Math.sin(this.waveTimer) * 2;

    // 1. Draw Hole Cup (Dark Inner Circle)
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.cupRadius, this.cupRadius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Draw Steel Pin Flagstick
    ctx.strokeStyle = '#eceff1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y - 28);
    ctx.stroke();

    // 3. Draw Red Waving Flag Cloth
    ctx.fillStyle = '#d50000';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 28);
    ctx.lineTo(this.x + 14 + waveOffset, this.y - 22);
    ctx.lineTo(this.x, this.y - 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - 28);
    ctx.lineTo(this.x + 8 + waveOffset, this.y - 24);
    ctx.lineTo(this.x, this.y - 20);
    ctx.closePath();
    ctx.fill();
  }
}
