export default class PreloadScene extends Phaser.Scene {
  private loading?: {
    overlay: Phaser.GameObjects.Container
    mask: Phaser.GameObjects.Rectangle
    spinner: Phaser.GameObjects.Rectangle
    text: Phaser.GameObjects.Text
  }
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    // 全屏 Loading 覆盖层（延迟显示，避免闪烁）
    const { width, height } = this.scale.gameSize
    const overlay = this.add.container(0, 0).setDepth(10000).setScrollFactor(0, 0)
    const mask = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.35)
      .setOrigin(0, 0)
      .setScrollFactor(0, 0)
    const spinner = this.add
      .rectangle(width / 2, height / 2, 24, 24, 0xffffff)
      .setOrigin(0.5)
      .setScrollFactor(0, 0)
    const text = this.add
      .text(width / 2, height / 2 + 36, '加载中… 0%', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#FFFFFF',
      })
      .setOrigin(0.5)
      .setScrollFactor(0, 0)

    overlay.add([mask, spinner, text])
    overlay.setVisible(false)

    // 旋转动画
    this.tweens.add({ targets: spinner, angle: 360, duration: 900, repeat: -1, ease: 'Linear' })

    // 保存引用并监听窗口变化以重排
    this.loading = { overlay, mask, spinner, text }
    const layout = () => this.layoutLoading()
    this.scale.on('resize', layout)

    // 延迟显示，避免极快加载时闪现
    const timer = this.time.delayedCall(200, () => overlay.setVisible(true))

    this.load.on('progress', (value: number) => {
      if (!overlay.visible) return
      text.setText(`加载中… ${Math.round(value * 100)}%`)
    })
    this.load.once('complete', () => {
      if (timer && timer.getProgress() < 1) timer.remove(false)
      this.scale.off('resize', layout)
      overlay.destroy()
      this.loading = undefined
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

  /**
   * 重排全屏 loading 覆盖层
   */
  private layoutLoading() {
    if (!this.loading) return
    const { width, height } = this.scale.gameSize
    const { overlay, mask, spinner, text } = this.loading
    overlay.setPosition(0, 0)
    mask.setSize(width, height)
    spinner.setPosition(width / 2, height / 2)
    text.setPosition(width / 2, height / 2 + 36)
  }
}
