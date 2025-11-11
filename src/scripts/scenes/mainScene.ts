import config from '../config'
import AnimatedTiles from '../helpers/animatedTiles'
import Debug from '../helpers/debug'
import CountDown from '../helpers/countdown'

import Hud from '../objects/hud'
import Player from '../objects/player'
import Brick from '../objects/brick'
import CoinSpin from '../objects/coinSpin'
import Flag from '../objects/flag'
import { Enemy, EnemyGroup, EnemyName } from '../objects/enemies'
import { PowerUpGroup } from '../objects/powerUps'

import { Move, Jump, Large, Fire, Invincible, EnterPipe, HitBrick } from '../powers'
import { arrayProps2ObjProps } from '../utils'
import { container } from 'tsyringe'

type SceneData = {
  [prop: string]: any
}

export default class MainScene extends Phaser.Scene {
  music: Phaser.Sound.BaseSound
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  animatedTiles: AnimatedTiles
  hud: Hud
  mario: Player
  powerUpGroup: PowerUpGroup
  enemyGroup: EnemyGroup
  rooms: rooms = {}
  dests: dests = {}

  constructor() {
    super({ key: 'MainScene' })
  }

  create(sceneData: SceneData) {
    // @ts-ignore debug
    window.__myGame = this

    const map = this.make.tilemap({ key: 'map' })
    const tileset = map.addTilesetImage('SuperMarioBros-World1-1', 'tiles')
    const worldLayer = map.createLayer('world', tileset!)!.setCollisionByProperty({ collide: true })

    const arrows = this.input.keyboard.createCursorKeys()
    const { KeyCodes } = Phaser.Input.Keyboard
    const wasd = this.input.keyboard.addKeys({
      up: KeyCodes.W,
      left: KeyCodes.A,
      down: KeyCodes.S,
      right: KeyCodes.D,
      space: KeyCodes.SPACE,
    }) as any
    const mergeKey = (a?: Phaser.Input.Keyboard.Key, b?: Phaser.Input.Keyboard.Key) =>
      ({
        get isDown() {
          return Boolean(a?.isDown || b?.isDown)
        },
      }) as unknown as Phaser.Input.Keyboard.Key
    this.cursors = {
      up: mergeKey(arrows.up, wasd.up),
      down: mergeKey(arrows.down, wasd.down),
      left: mergeKey(arrows.left, wasd.left),
      right: mergeKey(arrows.right, wasd.right),
      space: mergeKey((arrows as any).space, wasd.space),
    } as Phaser.Types.Input.Keyboard.CursorKeys

    // 添加背景音乐
    this.music = this.sound.add('overworld')
    this.music.play({ loop: true })

    // 远/近两层云（视差 + 轻微漂浮）
    const cloudsFar = this.add
      .tileSprite(0, 10, worldLayer.width, 120, 'background-clouds')
      .setOrigin(0, 0)
      .setScrollFactor(0.2, 0)
    const cloudsNear = this.add
      .tileSprite(0, 40, worldLayer.width, 140, 'background-clouds')
      .setOrigin(0, 0)
      .setScrollFactor(0.5, 0)
    this.tweens.add({ targets: cloudsFar, y: '+=3', duration: 2500, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    this.tweens.add({ targets: cloudsNear, y: '+=4', duration: 2200, yoyo: true, repeat: -1, ease: 'sine.inOut' })

    // 添加游戏说明（中文，缩小且略微透明，避免干扰）
    const help = this.add
      .text(12, 72, config.helpText, { fontFamily: 'sans-serif', fontSize: '12px', color: '#FFFFFF' })
      .setLineSpacing(4)
      .setDepth(100)
      .setScrollFactor(0, 0)
      .setAlpha(0.6)
    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: help, alpha: 0.25, duration: 800, ease: 'sine.out' })
    })

    // tile 动画
    this.animatedTiles = new AnimatedTiles(map, tileset!)

    this.parseModifiersLayer(map, 'modifiers')

    const enemiesData = this.parseEnemiesLayer(map, 'enemies')
    this.enemyGroup = new EnemyGroup(this, enemiesData)
    this.powerUpGroup = new PowerUpGroup(this)

    // 分数、金币、倒计时等信息显示
    this.hud = new Hud(this, [
      { title: 'SCORE', key: 'score', value: 0 },
      { title: 'COINS', key: 'coins', value: sceneData.coins || 0 },
      { title: 'TIME', key: 'time', value: config.playTime },
      { title: 'LIVES', key: 'lives', value: sceneData.lives || config.lives },
      { title: 'FPS', key: 'fps', value: () => Math.floor(this.game.loop.actualFps) },
    ])

    this.mario = new Player({
      scene: this,
      texture: 'atlas',
      frame: 'mario/stand',
      x: config.initX,
      y: config.initY,
      allowPowers: [Jump, Move, Invincible, Large, Fire, EnterPipe, HitBrick],
    }).on('die', () => {
      // 原地复活（或最近安全点），不重开关卡
      this.time.delayedCall(1200, () => {
        const pt = this.mario.getRespawnPoint()
        this.mario.reviveAt(pt.x, pt.y)
        // 恢复背景音乐
        if (!this.music.isPlaying) this.music.play({ loop: true })
      })
    })

    const endPoint = worldLayer.findByIndex(5)
    // 终点旗杆（确保找到终点）
    if (endPoint) {
      new Flag(this, endPoint.pixelX, endPoint.pixelY).overlap(this.mario, () => this.restartGame(false))
    }

    // 游戏倒计时
    new CountDown(this)
      .start(config.playTime)
      .on('interval', (time: number) => {
        this.hud.setValue('time', time)
      })
      .on('end', () => this.mario.die())

    // 调试
    new Debug({ scene: this, layer: worldLayer })

    // 砖块对象
    const brick = new Brick({ scene: this })

    // 在容器里注册这些对象，用于提供给依赖它们的类自动注入
    container
      .register('Map', { useValue: map })
      .register('WorldLayer', { useValue: worldLayer })
      .register('Cursors', { useValue: this.cursors })
      .register(Brick, { useValue: brick })
      .register(Player, { useValue: this.mario })
      .register(EnemyGroup, { useValue: this.enemyGroup })
      .register(PowerUpGroup, { useValue: this.powerUpGroup })

    this.mario.powers
      .add(Move, () => new Move(this.mario))
      .add(Jump, () => new Jump(this.mario))
      .add(EnterPipe, () => new EnterPipe(this.cursors, this.dests, this.rooms))
      .add(HitBrick, () => new HitBrick(this.mario, ['up']))

    const camera = this.cameras.main
    const room = this.rooms.room1
    camera.setBounds(room.x, room.y, room.width, room.height)
    camera.startFollow(this.mario, true, 0.1, 0.1)
    camera.setDeadzone(120, 60)
    camera.roundPixels = true
    // 初始缩放以适配屏幕（使用整数缩放避免像素模糊）
    camera.setZoom(1)
    this.hud.layout(this.scale.gameSize.width, 1)

    this.physics.add.collider(this.powerUpGroup, worldLayer)
    // @ts-ignore
    this.physics.add.collider(this.enemyGroup, worldLayer, this.enemyColliderWorld, undefined, this)
    // @ts-ignore
    this.physics.add.collider(this.mario, worldLayer, this.playerColliderWorld, undefined, this)
    // @ts-ignore
    this.physics.add.overlap(this.mario, this.enemyGroup, this.playerOverlapEnemy, undefined, this)
    // @ts-ignore
    this.physics.add.overlap(this.enemyGroup, this.enemyGroup, this.enemyOverlapEnemy, undefined, this)
    // @ts-ignore
    this.physics.add.collider(brick, this.enemyGroup, this.brickColliderEnemy, undefined, this)
    this.physics.add.collider(brick, this.powerUpGroup)

    // 监听尺寸变化，重新布局 HUD，并调整相机视口尺寸
    this.scale.on('resize', this.onResize, this)
  }

  update(time: number, delta: number) {
    if (this.physics.world.isPaused) return
    const { animatedTiles, hud, mario, cursors, enemyGroup, powerUpGroup } = this
    animatedTiles.update(delta)
    hud.update()
    mario.update(time, delta, cursors)
    enemyGroup.update(time, delta, mario)
    powerUpGroup.update(time, delta, mario)
  }

  /**
   * 解析修饰层，扩展瓷砖属性
   * @param name 图层名称
   */
  private parseModifiersLayer(map: Phaser.Tilemaps.Tilemap, name: string) {
    const worldLayer = map.getLayer('world')?.tilemapLayer as Phaser.Tilemaps.TilemapLayer
    if (!worldLayer) return
    const parser = {
      powerUp: (modifier: Phaser.Types.Tilemaps.TiledObject) => {
        const tile = worldLayer.getTileAt(Number(modifier.x) / 16, Number(modifier.y) / 16 - 1)
        tile.properties.powerUp = modifier.name
        switch (modifier.name) {
          case '1up':
            tile.properties.callback = 'questionMark'
            tile.setCollision(false, false, false, true)
            break
          case 'coin':
            tile.properties.hitNumber = 4
        }
      },
      pipe: (modifier: Phaser.Types.Tilemaps.TiledObject) => {
        const tile = worldLayer.getTileAt(Number(modifier.x) / 16, Number(modifier.y) / 16)
        tile.properties.dest = modifier.name
        Object.assign(tile.properties, arrayProps2ObjProps(modifier.properties))
      },
      dest: ({ name, x, y, properties }: Phaser.Types.Tilemaps.TiledObject) => {
        this.dests[name] = {
          name,
          x: Number(x),
          y: Number(y),
          ...arrayProps2ObjProps(properties),
        }
      },
      room: ({ name, x, y, width, height }: Phaser.Types.Tilemaps.TiledObject) => {
        this.rooms[name] = {
          name,
          x: Number(x),
          y: Number(y),
          width: Number(width),
          height: Number(height),
        }
      },
    }

    const objLayer = map.getObjectLayer(name)
    if (!objLayer) return
    objLayer.objects.forEach((tiled) => {
      parser[(tiled as any).type]?.(tiled as any)
    })
  }

  /**
   * 解析敌人图层，获取敌人的坐标数据
   * @param name 图层名称
   */
  private parseEnemiesLayer(map: Phaser.Tilemaps.Tilemap, name: string) {
    const layer = map.getObjectLayer(name)
    if (!layer) return [] as any[]
    return layer.objects.map((tile) => ({
      name: tile.name as EnemyName,
      x: tile.x as number,
      y: tile.y as number,
    }))
  }

  private enemyColliderWorld(enemy: Enemy, tile: Phaser.Tilemaps.Tile) {
    enemy.colliderWorld(tile)
  }

  private enemyOverlapEnemy(enemy1: Enemy, enemy2: Enemy) {
    enemy1.overlapEnemy(enemy2)
    enemy2.overlapEnemy(enemy1)
  }

  private playerOverlapEnemy(mario: Player, enemy: Enemy) {
    if (enemy.dead || mario.dead) return

    // body.touching 对象会出现多个为 true 的值，为避免错误，加上了玩家速度的判断。
    const stepOnEnemy = mario.body.touching.down && enemy.body.touching.up && mario.body.velocity.y !== 0

    if (mario.overlapEnemy(enemy, stepOnEnemy)) return
    if (enemy.overlapPlayer(mario, stepOnEnemy)) return

    if (stepOnEnemy) {
      mario.body.setVelocityY(-80)
    } else if (!mario.protected && enemy.attackPower) {
      mario.die()
    }
  }

  private playerColliderWorld(mario: Player, tile: Phaser.Tilemaps.Tile) {
    if (mario.colliderWorld(tile)) return
  }

  private brickColliderEnemy(brick: Brick, enemy: Enemy) {
    if (enemy.dead) return
    if (this.mario.powers.has(Large)) {
      enemy.die(true)
    }
  }

  /**
   * 创建道具
   * @param name 道具名
   */
  private createPowerUp(name: string, x: number, y: number) {
    const mario = this.mario
    const texture = 'atlas'

    switch (name) {
      case 'mushroom': {
        if (mario.powers.has(Large)) {
          import(/* webpackChunkName: "powerup-flower" */ '../objects/powerUps/flower').then(({ Flower }) => {
            const powerUp = new Flower({ scene: this, x, y, texture }).overlap(
              mario,
              () => mario.powers.add(Fire, () => new Fire(mario))
            )
            this.powerUpGroup.add(powerUp)
          })
        } else {
          import(/* webpackChunkName: "powerup-mushroom" */ '../objects/powerUps/mushroom').then(({ Mushroom }) => {
            const powerUp = new Mushroom({ scene: this, x, y, texture, type: 'super' } as any).overlap(
              mario,
              () => mario.powers.add(Large, () => new Large(mario))
            )
            this.powerUpGroup.add(powerUp)
          })
        }
        break
      }
      case 'star': {
        import(/* webpackChunkName: "powerup-star" */ '../objects/powerUps/star').then(({ Star }) => {
          const powerUp = new Star({ scene: this, x, y, texture }).overlap(
            mario,
            () => mario.powers.add(Invincible, () => new Invincible())
          )
          this.powerUpGroup.add(powerUp)
        })
        break
      }
      case '1up': {
        import(/* webpackChunkName: "powerup-mushroom" */ '../objects/powerUps/mushroom').then(({ Mushroom }) => {
          const powerUp = new Mushroom({ scene: this, x, y, texture, type: '1up' } as any).overlap(
            mario,
            () => this.hud.incDec('lives', 1)
          )
          this.powerUpGroup.add(powerUp)
        })
        break
      }
      default:
        new CoinSpin(this, x, y, texture).spin()
    }
  }

  private restartGame(saveData = true) {
    const data = saveData
      ? {
          coins: this.hud.getValue('coins'),
          lives: this.hud.getValue('lives'),
        }
      : {}
    container.clearInstances()
    this.scene.restart(data)
  }

  private gameOver() {
    if (window.confirm('GameOver!')) {
      this.restartGame(false)
    }
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width
    const height = gameSize.height
    this.cameras.resize(width, height)
    this.cameras.main.setZoom(1)
    this.hud.layout(width, 1)
  }
}
