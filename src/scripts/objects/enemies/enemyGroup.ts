import Player from '../player'
import type { Enemy } from './enemy'
import { removeArrayMember } from '../../utils'

export type EnemyName = 'goomba' | 'turtle'

export interface EnemyData {
  name: EnemyName
  x: number
  y: number
}

/**
 * 存储敌人的 Group
 */
export class EnemyGroup extends Phaser.GameObjects.Group {
  /**
   * 创建敌人时所需要的数据
   */
  enemiesData: EnemyData[] = []
  /**
   * 当从组里移除一个成员时，对应成员会 push 到这里，等待下次创建时再取出
   */
  pool: Enemy[] = []
  /**
   * 敌人与玩家的距离超出指定范围时，设置为不可见状态
   */
  private maxX = 500
  /**
   * 敌人与玩家的距离超出指定范围时，设置为不可见状态
   */
  private maxY = 500

  private loaders: Partial<Record<EnemyName, Promise<void>>> = {}
  private classes: Partial<Record<EnemyName, new (cfg: { scene: Phaser.Scene; x: number; y: number; texture: string }) => Enemy>> = {}

  constructor(scene: Phaser.Scene, enemiesData: EnemyData[] = []) {
    super(scene)
    this.enemiesData = enemiesData
    // @ts-ignore
    this.removeCallback = (enemy: Enemy) => {
      this.pool.push(enemy)
    }
  }

  /**
   * 创建对应敌人，并添加到组里
   * @param name 敌人的类型名称
   * @param x 水平坐标
   * @param y 垂直坐标
   */
  createEnemy(name: EnemyName, x: number, y: number) {
    let enemy = this.pool.find((enemy) => enemy.constructor.name.toLowerCase() === name)

    if (enemy) {
      enemy.restore(x, y)
      this.add(enemy)
      this.pool.splice(this.pool.indexOf(enemy), 1)
      return enemy
    }

    const Klass = this.classes[name]
    if (Klass) {
      const inst = new Klass({ scene: this.scene, x, y, texture: 'atlas' })
      this.add(inst)
      return inst
    }

    if (!this.loaders[name]) {
      this.loaders[name] = (async () => {
        switch (name) {
          case 'goomba': {
            const mod = await import(/* webpackChunkName: "enemy-goomba" */ './goomba')
            this.classes.goomba = mod.Goomba
            break
          }
          case 'turtle': {
            const mod = await import(/* webpackChunkName: "enemy-turtle" */ './turtle')
            this.classes.turtle = mod.Turtle
            break
          }
        }
      })()
    }

    // 未加载完成时，返回 undefined，本次不创建
    return undefined
  }

  update(time: number, delta: number, player: Player) {
    const canvas = this.scene.sys.game.canvas
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height

    // 当玩家与敌人距离小于画布宽度时才创建敌人，创建敌人后删除对应 enemiesData 数组的成员
    removeArrayMember(this.enemiesData, ({ x, y, name }: EnemyData) => {
      if (Math.abs(player.x - x) < canvasWidth) {
        const created = this.createEnemy(name, x, y)
        return !!created
      }
    })

    // @ts-ignore
    this.children.iterate((enemy: Enemy) => {
      if (enemy) {
        if (enemy.active) {
          // 超出与玩家的最大范围时从组里移除敌人
          if (
            Math.abs(player.x - enemy.x) > this.maxX + canvasWidth ||
            Math.abs(player.y - enemy.y) > this.maxY + canvasHeight
          ) {
            this.killAndHide(enemy)
            this.remove(enemy)
          }

          // 切换方向
          const isMovingRight = enemy.body.velocity.x >= 0
          enemy.setFlipX(!isMovingRight)
        } else {
          this.remove(enemy)
        }
      }
    })
  }
}
