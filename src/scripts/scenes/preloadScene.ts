export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    // 延迟显示的进度条：加载极快时不显示，避免白条闪烁
    const progress = this.add.graphics()
      .setScrollFactor(0, 0)
      .setDepth(1000)
      .setVisible(false)

    // 200ms 后再显示进度条（若加载很快会在 complete 前被销毁，从而不显示）
    const timer = this.time.delayedCall(200, () => progress.setVisible(true))

    this.load.on('progress', (value: number) => {
      if (!progress.visible) return
      const { width, height } = this.scale.gameSize
      progress.clear()
      progress.fillStyle(0xffffff, 1)
      // 居中且相对尺寸，避免因缩放模式不同出现拉伸或越界
      const barW = Math.floor(width * 0.6)
      const barH = 10
      const x = Math.floor((width - barW) / 2)
      const y = Math.floor(height * 0.6)
      progress.fillRect(x, y, Math.max(1, Math.floor(barW * value)), barH)
    })
    this.load.once('complete', () => {
      if (timer && timer.getProgress() < 1) timer.remove(false)
      progress.destroy()
    })

    // 背景
    this.load.image('background-clouds', 'assets/images/clouds.png')

    // 地图数据
    this.load.tilemapTiledJSON('map', 'assets/maps/super-mario.json')

    this.load.spritesheet('tiles', 'assets/images/super-mario.png', {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 2,
    })

    this.load.atlas('atlas', 'assets/mario-sprites.png', 'assets/mario-sprites.json')

    // 马赛克字体
    this.load.bitmapFont('font', 'assets/fonts/font.png', 'assets/fonts/font.fnt')

    // 背景音乐
    this.load.audio('overworld', 'assets/music/overworld.mp3')
    // 游戏特效音乐
    this.load.audioSprite('sfx', 'assets/audio/sfx.json', ['assets/audio/sfx.ogg', 'assets/audio/sfx.mp3'], {
      instances: 4,
    })
  }

  create() {
    // 动态加载 MainScene，按需分包，降低首屏体积
    import(/* webpackChunkName: "main-scene" */ './mainScene')
      .then(({ default: MainScene }) => {
        this.scene.add('MainScene', MainScene, true)
      })
      .catch((err) => {
        // 加载失败时可回退或提示
        // eslint-disable-next-line no-console
        console.error('加载 MainScene 失败', err)
      })
  }
}
