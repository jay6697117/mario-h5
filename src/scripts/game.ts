import 'phaser'
import PreloadScene from './scenes/preloadScene'

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 240

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#6888ff',
  render: {
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    parent: 'phaser-game',
    // 使用 FIT：按比例适配，避免任何裁剪
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  },
  scene: [PreloadScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 650 },
    },
  },
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})
