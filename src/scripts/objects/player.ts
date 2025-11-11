import { PowerManage } from '../powers'
import { Enemy } from '../objects/enemies'
import { lives } from '../helpers/decorators'

type Config = {
  scene: Phaser.Scene
  x: number
  y: number
  texture: string
  frame: string
  // 玩家的能力
  allowPowers: Function[]
}

/**
 * 玩家
 */
export default class Player extends Phaser.GameObjects.Sprite {
  body: Phaser.Physics.Arcade.Body
  /**
   * 能力管理
   */
  powers: PowerManage
  /**
   * 是否死亡
   */
  dead = false
  /**
   * 是否受保护
   */
  protected = false
  /**
   * 玩家动画 key 后缀
   */
  animSuffix = ''
  /**
   * 最近一次安全落地的位置（用于复活）
   */
  private lastSafePos: { x: number; y: number }
  private reviveProtectTimer?: Phaser.Time.TimerEvent
  private wasOnGround = false
  private static ensureDustTexture(scene: Phaser.Scene) {
    const key = 'dust'
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(3, 3, 3)
      g.generateTexture(key, 6, 6)
      g.destroy()
    }
    return key
  }

  /**
   * 确保用于复活粒子的贴图已生成
   */
  private static ensureRespawnTexture(scene: Phaser.Scene) {
    const key = 'respawn-star'
    if (!scene.textures.exists(key)) {
      const size = 16
      const cx = size / 2
      const cy = size / 2
      const outer = size / 2 - 1
      const inner = Math.max(2, Math.floor(outer * 0.45))
      const g = scene.make.graphics({ x: 0, y: 0, add: false })
      g.clear()
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

  constructor({ scene, x, y, texture, frame, allowPowers }: Config) {
    super(scene, x, y, texture, frame)
    scene.physics.world.enable(this)
    scene.add.existing(this)
    this.body.setSize(8, 16)
    this.makeAnimaions()
    this.powers = new PowerManage(this, allowPowers)
    this.lastSafePos = { x, y }
  }

  /**
   * 创建玩家行走跳跃等各种状态下的动画
   */
  private makeAnimaions() {
    const config = {
      frameRate: 10,
      repeat: -1,
      repeatDelay: 0,
    }

    // Mario animations: One without suffix, super after mushroom and fire after flower
    ;['', 'Super', 'Fire'].forEach((suffix: string) => {
      this.anims.create({
        key: 'run' + suffix,
        frames: this.anims.generateFrameNames('atlas', {
          prefix: 'mario/walk' + suffix,
          start: 1,
          end: 3,
        }),
        ...config,
      })

      // Jump, Stand and Turn: one frame each
      ;['jump', 'stand', 'turn', 'bend'].forEach((anim) => {
        if (anim === 'bend' && suffix === '') {
          // No bend animation when Mario is small
          return
        }
        this.anims.create({
          key: anim + suffix,
          frames: [
            {
              frame: 'mario/' + anim + suffix,
              key: 'atlas',
            },
          ],
          ...config,
        })
      })

      // Climb
      this.anims.create({
        key: 'climb' + suffix,
        frames: this.anims.generateFrameNames('atlas', {
          prefix: 'mario/climb' + suffix,
          start: 0,
          end: 1,
        }),
        ...config,
      })

      // Swim
      this.anims.create({
        key: 'swim' + suffix,
        frames: this.anims.generateFrameNames('atlas', {
          prefix: 'mario/swim' + suffix,
          start: 1,
          end: 5,
        }),
        ...config,
      })
    })

    const growFrames = [
      'mario/half',
      'mario/stand',
      'mario/half',
      'mario/standSuper',
      'mario/half',
      'mario/standSuper',
    ].map((frame) => ({ frame, key: 'atlas' }))

    this.anims.create({
      key: 'grow',
      frames: growFrames,
      frameRate: 10,
      repeat: 0,
      repeatDelay: 0,
    })

    this.anims.create({
      key: 'shrink',
      frames: growFrames.reverse(),
      frameRate: 10,
      repeat: 0,
      repeatDelay: 0,
    })

    this.anims.create({
      key: 'dead',
      frames: [{ frame: 'mario/dead', key: 'atlas' }],
      frameRate: 1,
      repeat: -1,
    })

    // fire
    this.anims.create({
      key: 'fire',
      frames: this.anims.generateFrameNames('atlas', {
        prefix: 'mario/walkFire',
        start: 1,
        end: 1,
      }),
    })
  }

  update(time: number, delta: number, cursors: Phaser.Types.Input.Keyboard.CursorKeys) {
    if (this.dead) return

    this.powers.allowPowers.some((name) => this.powers.get(name)?.update?.(time, delta, this, cursors))

    // 记录最近安全着地位置
    if (this.body.blocked?.down) {
      this.lastSafePos = { x: this.x, y: this.y }
    }
    // 落地瞬间：尘土 + 挤压
    const onGround = !!this.body.blocked?.down
    if (onGround && !this.wasOnGround) {
      this.scene.tweens.add({ targets: this, scaleX: 1.05, scaleY: 0.95, duration: 80, yoyo: true, ease: 'quad.out' })
      const key = Player.ensureDustTexture(this.scene)
      const pm = this.scene.add.particles(key)
      const emitter = pm.createEmitter({ lifespan: 350, speed: { min: 40, max: 90 }, quantity: 0, gravityY: 200, angle: { min: 220, max: 320 }, scale: { start: 1, end: 0 }, })
      emitter.explode(10, this.x, this.y + 6)
      this.scene.time.delayedCall(400, () => pm.destroy())
    }
    this.wasOnGround = onGround

    // 如果不在地图的可视范围内则死亡
    if (this.x < 0 || this.y > this.scene.sys.game.canvas.height) {
      this.die()
    }
  }

  /**
   * 玩家死亡
   */
  @lives(-1)
  die() {
    this.dead = true
    this.scene.sound.stopAll()
    this.scene.sound.playAudioSprite('sfx', 'smb_mariodie')
    this.body.checkCollision.none = true
    this.body.setAcceleration(0, 0).setVelocity(0, -200)
    this.anims.play('dead')
    this.emit('die')
  }

  /** 复活（默认在最后安全点） */
  reviveAt(x?: number, y?: number) {
    const pos = this.getRespawnPoint()
    const nx = x ?? pos.x
    const ny = y ?? pos.y
    this.dead = false
    this.body.checkCollision.none = false
    this.body.setAcceleration(0, 0).setVelocity(0, 0)
    this.setPosition(nx, ny)
    // 结束可能遗留的透明度动画
    this.scene.tweens.killTweensOf(this)
    // 闪烁效果：短暂半透明并闪烁，完成后强制回到 1
    this.setAlpha(0.6)
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 100,
      yoyo: true,
      repeat: 6,
      onComplete: () => this.setAlpha(1),
    })
    this.protected = true
    this.anims.play('stand' + this.animSuffix, true)
    // 粒子爆发
    const key = Player.ensureRespawnTexture(this.scene)
    const pm = this.scene.add.particles(key)
    const emitter = pm.createEmitter({
      lifespan: 500,
      speed: { min: 80, max: 180 },
      quantity: 0,
      scale: { start: 1, end: 0 },
      angle: { min: 0, max: 360 },
      gravityY: 0,
      blendMode: 'ADD' as any,
    })
    emitter.explode(24, nx, ny)
    this.scene.time.delayedCall(600, () => pm.destroy())
    // 短暂无敌，避免刚复活立刻再次死亡
    if (this.reviveProtectTimer) this.reviveProtectTimer.remove()
    this.reviveProtectTimer = this.scene.time.delayedCall(1500, () => {
      this.setAlpha(1)
      this.protected = false
    })
  }

  /** 获取复活位置：若掉出屏幕则返回最近安全点 */
  getRespawnPoint() {
    const canvasH = this.scene.sys.game.canvas.height
    if (this.y > canvasH) return this.lastSafePos
    return { x: this.x, y: this.y }
  }

  /**
   * 接触敌人时调用该方法
   * @param enemy 敌人
   * @param stepOnEnemy 玩家是否踩到敌人
   */
  overlapEnemy(enemy: Enemy, stepOnEnemy: boolean) {
    return this.powers.allowPowers.some((name) => this.powers.get(name)?.overlapEnemy?.(this, enemy, stepOnEnemy))
  }

  /**
   * 接触地图时调用该方法
   * @param tile tile
   */
  colliderWorld(tile: Phaser.Tilemaps.Tile) {
    return this.powers.allowPowers.some((name) => this.powers.get(name)?.colliderWorld?.(this, tile))
  }
}
