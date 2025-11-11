import { Enemy } from '../objects/enemies'
import { Power, TargetObject } from './index'
import cfg from '../config'

/**
 * 无敌的能力
 */
export class Invincible implements Power {
  /**
   * 当前时间
   */
  private current: number = 0
  /**
   * 持续时间
   */
  private duration: number = 10000
  /**
   * 无敌动画的当前帧索引
   */
  private frameIndex: number = 0

  /**
   * 无敌状态下玩家颜色变换数组
   */
  private tints = [0xffffff, 0xff0000, 0xffffff, 0x00ff00, 0xffffff, 0x0000ff]
  private pm?: Phaser.GameObjects.Particles.ParticleEmitterManager
  private trail?: Phaser.GameObjects.Particles.ParticleEmitter

  private ensureStarTexture(scene: Phaser.Scene) {
    const key = 'respawn-star'
    if (!scene.textures.exists(key)) {
      // 复用 Player 里的生成逻辑的简化版
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

  public update(time: number, delta: number, targetObject: TargetObject) {
    // 星星拖尾
    if (cfg.fx?.trails && !this.pm) {
      const key = this.ensureStarTexture(targetObject.scene)
      this.pm = targetObject.scene.add.particles(key)
      this.trail = this.pm.createEmitter({
        follow: targetObject as any,
        lifespan: 400,
        frequency: 45,
        alpha: { start: 1, end: 0 },
        scale: { start: 0.8, end: 0 },
        speed: { min: 10, max: 30 },
        blendMode: 'ADD' as any,
        quantity: 1,
      })
    }
    this.current += delta
    // 时间结束移除能力
    if (this.current >= this.duration) {
      targetObject.powers.remove(Invincible)
    } else {
      targetObject.setTint(this.tints[this.frameIndex++])
      this.frameIndex %= this.tints.length
    }
  }

  public overlapEnemy(targetObject: TargetObject, enemy: Enemy) {
    // 与敌人接触时，干掉敌人
    enemy.die(true)
    return true
  }

  public beforeRemove(targetObject: TargetObject) {
    targetObject.setTint(this.tints[0])
    if (this.trail) this.trail.stop()
    if (this.pm) targetObject.scene.time.delayedCall(500, () => this.pm?.destroy())
  }
}
