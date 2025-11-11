import { Power } from './index'
import Player from '../objects/player'

/**
 * 进出管道能力
 */
export class EnterPipe implements Power {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private rooms: rooms
  private dests: dests

  constructor(cursors: Phaser.Types.Input.Keyboard.CursorKeys, dests: dests, rooms: rooms) {
    this.cursors = cursors
    this.dests = dests
    this.rooms = rooms
  }

  public colliderWorld(player: Player, tile: Phaser.Tilemaps.Tile) {
    const properties = tile.properties

    if (properties?.dest && this.cursors[properties.direction].isDown) {
      this.transfer(player, properties.direction, this.dests[properties.dest])
    }
  }

  /**
   * 进入管道 -> 淡出 -> 瞬移到目的地 -> 淡入 -> 出管道
   */
  private transfer(player: Player, enterDir: string, dest: { x: number; y: number; direction?: string }) {
    // 进入管道动画
    this.pipeAnimation(player, enterDir, () => {
      const cam = player.scene.cameras.main
      cam.fadeOut(180, 0, 0, 0)
      cam.once('camerafadeoutcomplete', () => {
        this.moveTo(player, dest.x + player.width, dest.y + player.height / 2)
        cam.fadeIn(180, 0, 0, 0)
        if (dest.direction) {
          this.pipeAnimation(player, dest.direction)
        }
      })
    })
  }

  /**
   * 进出管道的动画
   * @param player 玩家
   * @param direction 从哪个方向进出
   * @param callback 动画结束回调
   */
  private pipeAnimation(player: Player, direction: string, callback?: Function) {
    player
      .play('stand' + player.animSuffix, true)
      .setDepth(-1)
      .body.stop()

    player.scene.physics.world.pause()
    player.scene.sound.playAudioSprite('sfx', 'smb_pipe', { rate: 0.95 + Math.random() * 0.1 })

    const propMap = {
      down: ['y', 1],
      up: ['y', -1],
      right: ['x', 1],
      left: ['x', -1],
    }
    const [prop, value] = propMap[direction]

    player.scene.tweens.add({
      targets: player,
      [prop]: player[prop] + player.height * value,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        player.scene.physics.world.resume()
        player.setDepth(1)
        callback?.()
      },
    })
  }

  /**
   * 将玩家移动到指定坐标，并更新相机边界
   * @param x
   * @param y
   */
  private moveTo(player: Player, x: number, y: number) {
    Object.values(this.rooms)
      .sort((a, b) => a.x - b.x)
      .some((room) => {
        if (x < room.x + room.width) {
          // 更新相机与物理世界边界，以保持跌出底部判定与视口一致
          player.scene.cameras.main.setBounds(room.x, room.y, room.width, room.height)
          player.scene.physics.world.setBounds(room.x, room.y, room.width, room.height)
          return true
        }
      })
    player.setX(x).setY(y)
  }
}
