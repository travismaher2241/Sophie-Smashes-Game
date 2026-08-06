import { Game } from './engine/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game('game-canvas');
  game.boot().catch((err) => {
    console.error('Failed to boot game engine:', err);
  });
});
