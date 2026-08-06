/**
 * Procedural 16-Bit Retro Pixel-Art Generators for Golf Maps & Sophie Player Sprite Sheet
 * Provides 100% playable 16-bit canvas art fallbacks out of the box.
 */

/**
 * Generate Sophie 16-Bit Player Swing Sprite Sheet
 * 8 Frames (Each 48x48 pixels):
 * Frame 0: Address (Holding club down)
 * Frame 1: Wiggle Address
 * Frame 2: Backswing Low
 * Frame 3: Backswing Mid
 * Frame 4: Top of Swing Apex
 * Frame 5: Downswing Acceleration
 * Frame 6: Impact Snap (Flash)
 * Frame 7: High Follow-through
 */
export function generateSophieSpriteSheet() {
  const frameW = 48;
  const frameH = 48;
  const numFrames = 8;
  
  const canvas = document.createElement('canvas');
  canvas.width = frameW * numFrames;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < numFrames; i++) {
    const offsetX = i * frameW;
    drawSophieFrame(ctx, offsetX, 0, frameW, frameH, i);
  }

  return canvas;
}

function drawSophieFrame(ctx, x, y, w, h, frameIndex) {
  // Center anchor
  const cx = x + w / 2;
  const cy = y + h / 2 + 4;

  // 16-Bit Color Palette for Sophie
  const P = {
    hair: '#e65100',      // Vibrant Auburn / Red-orange hair
    skin: '#ffcc80',      // Retro Peach skin tone
    visor: '#ffffff',     // White golf visor
    shirt: '#d500f9',     // Magenta / Purple golf shirt
    skirt: '#ffffff',     // White pleated skirt
    shoes: '#37474f',     // Dark charcoal shoes
    clubShaft: '#cfd8dc', // Silver steel shaft
    clubHead: '#90a4ae',  // Steel club head
    shadow: 'rgba(0,0,0,0.35)'
  };

  // Shadow
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pose angles based on swing frame index
  let clubAngle = 0;
  let bodyOffset = 0;
  let impactFlash = false;

  switch (frameIndex) {
    case 0: // Address
      clubAngle = Math.PI / 2;
      break;
    case 1: // Address Wiggle
      clubAngle = Math.PI / 2 + 0.1;
      break;
    case 2: // Backswing 1
      clubAngle = Math.PI / 4;
      bodyOffset = -1;
      break;
    case 3: // Backswing 2
      clubAngle = -Math.PI / 6;
      bodyOffset = -2;
      break;
    case 4: // Top of Swing
      clubAngle = -Math.PI / 2 - 0.3;
      bodyOffset = -3;
      break;
    case 5: // Downswing
      clubAngle = 0;
      bodyOffset = 1;
      break;
    case 6: // Impact
      clubAngle = Math.PI / 2 + 0.2;
      bodyOffset = 2;
      impactFlash = true;
      break;
    case 7: // Follow Through
      clubAngle = Math.PI + 0.5;
      bodyOffset = 3;
      break;
  }

  // Draw Feet & Shoes
  ctx.fillStyle = P.shoes;
  ctx.fillRect(cx - 7 + bodyOffset, cy + 10, 5, 4);
  ctx.fillRect(cx + 2 + bodyOffset, cy + 10, 5, 4);

  // Draw Legs
  ctx.fillStyle = P.skin;
  ctx.fillRect(cx - 5 + bodyOffset, cy + 5, 3, 5);
  ctx.fillRect(cx + 2 + bodyOffset, cy + 5, 3, 5);

  // Draw Skirt
  ctx.fillStyle = P.skirt;
  ctx.beginPath();
  ctx.moveTo(cx - 7 + bodyOffset, cy + 5);
  ctx.lineTo(cx + 7 + bodyOffset, cy + 5);
  ctx.lineTo(cx + 5 + bodyOffset, cy - 1);
  ctx.lineTo(cx - 5 + bodyOffset, cy - 1);
  ctx.closePath();
  ctx.fill();

  // Draw Torso / Shirt
  ctx.fillStyle = P.shirt;
  ctx.fillRect(cx - 4 + bodyOffset, cy - 8, 8, 7);

  // Draw Head & Hair
  ctx.fillStyle = P.hair;
  ctx.beginPath();
  ctx.arc(cx + bodyOffset, cy - 12, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = P.skin;
  ctx.fillRect(cx - 3 + bodyOffset, cy - 14, 6, 5);

  // Draw Visor
  ctx.fillStyle = P.visor;
  ctx.fillRect(cx - 5 + bodyOffset, cy - 15, 10, 2);

  // Draw Golf Club (Shaft & Head)
  ctx.save();
  ctx.translate(cx + bodyOffset, cy - 4);
  ctx.rotate(clubAngle);

  ctx.strokeStyle = P.clubShaft;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.stroke();

  ctx.fillStyle = P.clubHead;
  ctx.fillRect(-2, 17, 6, 3);
  ctx.restore();

  // Impact Flash effect
  if (impactFlash) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + 14, cy + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(cx + 14, cy + 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Procedural 16-Bit Golf Course Map Generator (9 Holes)
 */
export function generateProceduralHoleMap(holeNum, width = 1280, height = 960) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Solid Black Background (Out of Bounds)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // Layout parameters based on hole number
  const holeConfigs = {
    1: { name: 'Pine Valley', par: 4, yStart: 850, yEnd: 150, xOffset: 0, bunkers: 2, water: false },
    2: { name: 'Dogleg Ridge', par: 4, yStart: 850, yEnd: 200, xOffset: 300, bunkers: 3, water: false },
    3: { name: 'Island Green', par: 3, yStart: 800, yEnd: 250, xOffset: 0, bunkers: 2, water: true },
    4: { name: 'Sand Canyon', par: 5, yStart: 900, yEnd: 120, xOffset: -200, bunkers: 6, water: false },
    5: { name: 'Creek Crossing', par: 4, yStart: 850, yEnd: 180, xOffset: 150, bunkers: 2, water: true },
    6: { name: 'Monster Par 5', par: 5, yStart: 920, yEnd: 100, xOffset: 350, bunkers: 4, water: true },
    7: { name: 'Cliffside Drop', par: 3, yStart: 750, yEnd: 220, xOffset: -150, bunkers: 3, water: true },
    8: { name: 'Twin Bunkers', par: 4, yStart: 850, yEnd: 160, xOffset: 0, bunkers: 5, water: false },
    9: { name: 'Championship Finish', par: 4, yStart: 880, yEnd: 140, xOffset: -250, bunkers: 4, water: true }
  };

  const cfg = holeConfigs[holeNum] || holeConfigs[1];
  const cx = width / 2;

  // 1. Draw Outer Rough Patch (Dark Forest Green)
  ctx.fillStyle = '#1b5e20';
  ctx.beginPath();
  ctx.ellipse(cx, height / 2, width * 0.38, height * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Draw Fairway (Vivid Mid Green)
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.moveTo(cx - 70, cfg.yStart);

  if (cfg.xOffset !== 0) {
    // Curved Dogleg Fairway
    const midY = (cfg.yStart + cfg.yEnd) / 2;
    ctx.quadraticCurveTo(cx + cfg.xOffset, midY, cx, cfg.yEnd);
    ctx.quadraticCurveTo(cx + cfg.xOffset - 100, midY, cx + 70, cfg.yStart);
  } else {
    // Straight Fairway
    ctx.lineTo(cx - 65, cfg.yEnd);
    ctx.lineTo(cx + 65, cfg.yEnd);
    ctx.lineTo(cx + 70, cfg.yStart);
  }
  ctx.closePath();
  ctx.fill();

  // 3. Draw Tee Box (Light Green Rectangle at Bottom)
  const teeX = cx - 35;
  const teeY = cfg.yStart - 30;
  ctx.fillStyle = '#388e3c';
  ctx.fillRect(teeX, teeY, 70, 40);
  ctx.strokeStyle = '#81c784';
  ctx.lineWidth = 3;
  ctx.strokeRect(teeX, teeY, 70, 40);

  // Tee Markers
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(teeX + 10, teeY + 18, 6, 6);
  ctx.fillRect(teeX + 54, teeY + 18, 6, 6);

  // 4. Draw Putting Green (Bright Neon Green Oval at Top)
  const greenX = cx + (cfg.xOffset > 0 ? cfg.xOffset / 2.5 : cfg.xOffset / 2.5);
  const greenY = cfg.yEnd;
  ctx.fillStyle = '#00e676';
  ctx.beginPath();
  ctx.ellipse(greenX, greenY, 75, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#69f0ae';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 5. Draw Water Hazards (Blue)
  if (cfg.water) {
    ctx.fillStyle = '#0288d1';
    ctx.beginPath();
    ctx.ellipse(greenX - 90, greenY + 60, 80, 50, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 6. Draw Sand Bunkers (Gold/Yellow)
  ctx.fillStyle = '#fbc02d';
  for (let b = 0; b < cfg.bunkers; b++) {
    const bx = greenX + (b % 2 === 0 ? 80 : -85) + (b * 12);
    const by = greenY + (b * 35) - 20;
    ctx.beginPath();
    ctx.ellipse(bx, by, 35, 22, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff59d';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 7. Draw Pixel-Art Pine Trees around margins
  ctx.fillStyle = '#0a3200';
  for (let i = 0; i < 45; i++) {
    const angle = (i / 45) * Math.PI * 2;
    const rx = width * 0.41 + (Math.sin(i * 3) * 20);
    const ry = height * 0.46 + (Math.cos(i * 2) * 20);
    const tx = cx + Math.cos(angle) * rx;
    const ty = (height / 2) + Math.sin(angle) * ry;

    // Tree Canopy
    ctx.beginPath();
    ctx.arc(tx, ty, 16 + (i % 4) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    canvas,
    metadata: {
      hole: holeNum,
      name: cfg.name,
      par: cfg.par,
      teePos: { x: cx, y: cfg.yStart - 10 },
      pinPos: { x: greenX, y: greenY },
      width,
      height
    }
  };
}
