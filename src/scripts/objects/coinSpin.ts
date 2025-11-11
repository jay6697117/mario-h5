import { coins } from '../helpers/decorators'

/**
 * 金币旋转动画
 */
export default class CoinSpin extends Phaser.GameObjects.Sprite {
  body: Phaser.Physics.Arcade.Body

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture, 'coin/spin1')
    scene.physics.world.enable(this)
    scene.add.existing(this)

    this.body.setAllowGravity(false)

    scene.anims.create({
      key: 'coinSpin',
      frames: this.anims.generateFrameNames(texture, {
        prefix: 'coin/spin',
        start: 1,
        end: 4,
      }),
      frameRate: 15,
      repeat: -1,
      repeatDelay: 0,
    })
  }

  @coins(1)
  spin() {
    this.anims.play('coinSpin')

    this.scene.tweens.add({
      targets: this,
      y: this.y - 50,
      duration: 300,
      onComplete: () => {
        // 金币拾取：星星粒子爆发（复用程序化 star 贴图，短生命周期，避免常驻）
        const ensureStarTexture = (scene: Phaser.Scene) => {
          const key = 'respawn-star'
          if (!scene.textures.exists(key)) {
            const size = 12
            const cx = size / 2
            const cy = size / 2
            const outer = size / 2 - 1
            const inner = Math.max(2, Math.floor(outer * 0.45))
            const g = scene.make.graphics({ x: 0, y: 0, add: false })
            g.fillStyle(0xfff27a, 1)
            const points: { x: number; y: number }[] = []
            let rot = -Math.PI / 2
            const spikes = 5
            const step = Math.PI / spikes
            for (let i = 0; i < spikes; i++) {
              points.push({ x: cx + Math.cos(rot) * outer, y: cy + Math.sin(rot) * outer })
              rot += step
              points.push({ x: cx + Math.cos(rot) * inner, y: cy + Math.sin(rot) * inner })
              rot += step
            }
            g.fillPoints(points as any, true)
            g.generateTexture(key, size, size)
            g.destroy()
          }
          return key
        }

        const key = ensureStarTexture(this.scene)
        const pm = this.scene.add.particles(key)
        const emitter = pm.createEmitter({
          lifespan: 450,
          speed: { min: 70, max: 140 },
          quantity: 0,
          angle: { min: 200, max: 340 },
          gravityY: 300,
          scale: { start: 1, end: 0 },
          blendMode: 'ADD' as any,
        })
        emitter.explode(12, this.x, this.y - 60)
        this.scene.time.delayedCall(600, () => pm.destroy())

        // 浮动+1提示
        const tip = this.scene.add
          .text(this.x, this.y - 60, '+1', { fontFamily: 'sans-serif', fontSize: '12px', color: '#FFFFFF' })
          .setOrigin(0.5)
          .setScrollFactor(0)
        this.scene.tweens.add({ targets: tip, y: tip.y - 16, alpha: 0, duration: 600, ease: 'sine.out', onComplete: () => tip.destroy() })
        this.destroy()
      },
    })
    // 轻微随机速率，减轻听觉疲劳
    this.scene.sound.playAudioSprite('sfx', 'smb_coin', { rate: 0.95 + Math.random() * 0.1 })
  }
}
