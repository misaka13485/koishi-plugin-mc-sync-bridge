import { Context, Logger } from 'koishi'
import { Config } from '../index'
import { ServerConnection } from '../connection'
import { formatGroupIdForBroadcast } from '../utils/helpers'

export function apply(
  ctx: Context,
  config: Config,
  connection: ServerConnection,
  logger: Logger
) {
  ctx.on('mc-bridge/mc-message', (msg: any) => {
    const filter = config.filters.mcToQq
    if (!filter.enable) return

    // 事件类型过滤
    let eventAllowed = true
    if (msg.post_type === 'notice') {
      switch (msg.event_name) {
        case 'PlayerJoinEvent':
          eventAllowed = filter.join !== false
          break
        case 'PlayerQuitEvent':
          eventAllowed = filter.leave !== false
          break
        case 'PlayerDeathEvent':
          eventAllowed = filter.death !== false
          break
        case 'PlayerAchievementEvent':
          eventAllowed = filter.achievement !== false
          break
        default:
          eventAllowed = false
      }
    } else if (msg.post_type === 'message') {
      if (msg.event_name === 'PlayerChatEvent') {
        eventAllowed = filter.chat !== false
      } else {
        eventAllowed = false
      }
    } else {
      eventAllowed = false
    }
    if (!eventAllowed) return

    // 聊天消息前缀过滤
    let matchedPrefix = ''
    if (msg.post_type === 'message' && msg.event_name === 'PlayerChatEvent') {
      const content = msg.message || msg.raw_message || ''
      if (filter.prefixes && filter.prefixes.length > 0) {
        // 查找匹配的前缀
        matchedPrefix = filter.prefixes.find(prefix => content.startsWith(prefix)) || ''
        if (!matchedPrefix) return
      }
    }

    // 格式化为可读文本，传入匹配的前缀用于去除
    const text = formatMessage(config.name, msg, logger, config.debug, matchedPrefix)
    if (!text) return

    // 调试输出最终消息
    if (config.debug) {
      logger.info(`[${config.name}] 发送到QQ群: ${text}`)
    }

    // 发送到绑定的QQ群
    for (const groupId of config.groups) {
      const formattedGroupId = formatGroupIdForBroadcast(groupId)
      ctx.broadcast([formattedGroupId], text)
    }
  })
}

/**
 * 格式化消息为可读文本（适配鹊桥 v0.4.1+）
 * @param serverName 服务器显示名称
 * @param msg 鹊桥消息对象
 * @param logger 日志记录器
 * @param debug 是否调试模式
 * @param matchedPrefix 匹配的前缀（如果有），将在聊天消息中去除
 * @returns 格式化后的字符串，null 表示忽略
 */
function formatMessage(
  serverName: string,
  msg: any,
  logger: Logger,
  debug: boolean,
  matchedPrefix: string = ''
): string | null {
  const prefix = `[${serverName}]`

  // 1. 处理通知事件 (post_type = 'notice')
  if (msg.post_type === 'notice') {
    const player = msg.player
    const playerName = player?.nickname || player?.name || '未知玩家'

    switch (msg.event_name) {
      case 'PlayerJoinEvent': {
        const x = player?.x !== undefined ? Math.floor(player.x) : '?'
        const y = player?.y !== undefined ? Math.floor(player.y) : '?'
        const z = player?.z !== undefined ? Math.floor(player.z) : '?'
        return `${prefix} ${playerName} 加入了游戏 位于 (${x}, ${y}, ${z})`
      }

      case 'PlayerQuitEvent':
        return `${prefix} ${playerName} 离开了游戏`

      case 'PlayerDeathEvent': {
        const deathText = msg.death?.text
        if (!deathText) {
          logger.warn(`[${serverName}] 死亡消息缺少 text 字段: ${JSON.stringify(msg.death)}`)
          return null
        }
        if (deathText.includes('%') || /^[a-z]+\.[a-z]+\.[a-z]+/.test(deathText)) {
          logger.warn(`[${serverName}] 死亡消息可能未翻译: ${deathText}`)
        }
        return `${prefix} ${deathText}`
      }

      case 'PlayerAchievementEvent': {
        const achievementText = 
          msg.achievement?.translation?.text ||
          msg.achievement?.translate?.text ||
          msg.achievement?.text
        if (!achievementText) {
          logger.warn(`[${serverName}] 成就消息缺少文本字段: ${JSON.stringify(msg.achievement)}`)
          return null
        }
        if (debug) {
          logger.debug(`[${serverName}] 成就消息文本: ${achievementText}`)
        }
        if (achievementText.includes('%') || /^[a-z]+\.[a-z]+\.[a-z]+/.test(achievementText)) {
          logger.warn(`[${serverName}] 成就消息可能未翻译: ${achievementText}`)
        }
        return `${prefix} ${achievementText}`
      }

      default:
        return null
    }
  }

  // 2. 处理消息事件 (post_type = 'message')
  if (msg.post_type === 'message') {
    const playerName = msg.player?.nickname || msg.player?.name || '未知玩家'

    switch (msg.event_name) {
      case 'PlayerChatEvent': {
        let chatContent = msg.message || msg.raw_message || ''
        // 如果匹配了前缀，去除前缀
        if (matchedPrefix && chatContent.startsWith(matchedPrefix)) {
          chatContent = chatContent.slice(matchedPrefix.length).trimStart()
        }
        // 确保包含玩家名
        return `${prefix} ${playerName}: ${chatContent}`
      }

      case 'PlayerCommandEvent': {
        const command = msg.command || ''
        return `${prefix} ${playerName} 执行命令: /${command}`
      }

      default:
        return null
    }
  }

  // 3. 兼容旧版格式（type 字段，如 bridge 旧版）
  if (msg.type) {
    const { type, data } = msg
    switch (type) {
      case 'chat':
        return `${prefix} <${data.player}> ${data.message}`
      case 'system':
        return `${prefix} ${data.content}`
      case 'join':
        return `${prefix} ${data.player} 加入了游戏`
      case 'leave':
        return `${prefix} ${data.player} 离开了游戏`
      case 'death':
        return `${prefix} ${data.player} ${data.message}`
      default:
        return null
    }
  }

  // 4. 无法识别的消息，忽略
  return null
}