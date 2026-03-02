import { Context, h, Logger } from 'koishi'
import { Config } from '../index'
import { isUserAllowed } from '../utils/helpers'
import { ServerConnection } from '../connection'

/**
 * RCON命令执行超时错误类
 * 用于标识RCON命令执行超时的情况
 */
class TimeoutError extends Error {
  constructor() {
    super('RCON命令执行超时')
    this.name = 'TimeoutError'
  }
}

/**
 * 应用RCON命令处理器
 * 
 * @param ctx - Koishi上下文对象
 * @param config - 插件配置
 * @param connection - 服务器连接对象
 * @param logger - 日志记录器
 */
export function apply(
  ctx: Context,
  config: Config,
  connection: ServerConnection,
  logger: Logger
) {
  // 注册RCON命令：mc.rcon <command:text>
  ctx.command('mc.rcon <command:text>', '向MC服务器发送RCON命令')
    .action(async ({ session }, command: string) => {
      // 1. 检查是否在群聊中使用
      if (!session.guildId) {
        return '请在群聊中使用'
      }

      // 2. 检查当前群是否绑定到此服务器
      const groupMatch = config.groups.some(g => {
        const parts = g.split(':')
        const gNum = parts.length > 1 ? parts[1] : g
        const sessionParts = session.guildId.split(':')
        const sessionNum = sessionParts.length > 1 ? sessionParts[1] : session.guildId
        return gNum === sessionNum
      })
      
      if (!groupMatch) {
        return '当前群未绑定此服务器'
      }

      // 3. 检查用户权限
      if (!isUserAllowed(session.userId, config.admins)) {
        return '你没有权限执行RCON命令'
      }

      // 4. 创建RCON命令Promise和超时Promise
      const rconPromise = connection.sendRcon(command)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TimeoutError()), 1000)
      })

      try {
        // 5. 尝试快速执行（1秒超时）
        const rconResult = await Promise.race([rconPromise, timeoutPromise])
        
        // 6. 发送执行结果（引用原消息）
        await session.send(h('quote', { id: session.messageId }) + `${rconResult}`)
      } catch (err) {
        // 7. 处理执行错误
        if (err instanceof TimeoutError) {
          // 超时情况：发送提示消息，然后等待完整执行
          const hint = await session.send('正在执行RCON命令，请稍候...')
          const hintId = hint?.[0]

          try {
            // 8. 等待RCON命令完整执行
            const rconResult = await rconPromise
            
            // 9. 删除提示消息（如果支持）
            if (hintId && session.bot?.deleteMessage) {
              await session.bot.deleteMessage(session.channelId, hintId).catch(() => {})
            }
            
            // 10. 发送执行结果
            await session.send(h('quote', { id: session.messageId }) + `${rconResult}`)
          } catch (execErr) {
            // 11. 处理执行失败情况
            if (hintId && session.bot?.deleteMessage) {
              await session.bot.deleteMessage(session.channelId, hintId).catch(() => {})
            }
            await session.send(h('quote', { id: session.messageId }) + `RCON执行失败: ${execErr.message}`)
          }
        } else {
          // 12. 处理其他错误
          await session.send(h('quote', { id: session.messageId }) + `RCON执行失败: ${err.message}`)
        }
      }
    })
}