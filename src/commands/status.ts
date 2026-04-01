import { Context, Logger } from 'koishi'
import { Config } from '../index'
import { ServerConnection } from '../connection'
import { ServerStatus } from '../utils/motd'

/**
 * 服务器状态命令处理器
 * 提供mc一级命令，显示服务器状态
 */
export function apply(
  ctx: Context,
  config: Config,
  connection: ServerConnection,
  logger: Logger
) {
  // 注册mc一级命令
  ctx.command('mc', '查看Minecraft服务器状态')
    .action(async ({ session }) => {
      if (!session.guildId) return '请在群聊中使用'

      // 检查当前群是否属于此服务器
      const groupMatch = config.groups.some(g => {
        const parts = g.split(':')
        const gNum = parts.length > 1 ? parts[1] : g
        const sessionParts = session.guildId.split(':')
        const sessionNum = sessionParts.length > 1 ? sessionParts[1] : session.guildId
        return gNum === sessionNum
      })
      if (!groupMatch) return '当前群未绑定此服务器'

      try {
        // 如果启用了MOTD查询，显示服务器状态
        if (config.motd?.enabled) {
          try {
            const motdStatus = await connection.queryMotdStatus()
            
            // 调试模式下显示原始内容
            if (config.debug) {
              logger.debug(`[${config.name}] MOTD查询原始结果: %o`, motdStatus)
            }
            
            if (motdStatus.online) {
              // 在线：显示服务器名称、人数、服务器描述
              let statusMessage = `服务器名称： ${config.name}\n`
              
              if (motdStatus.players) {
                statusMessage += `在线玩家：  ${motdStatus.players.online}/${motdStatus.players.max}\n`
              }
              
              if (motdStatus.motd) {
                // 处理MOTD，可能是字符串或对象
                let motdText = ''
                
                if (typeof motdStatus.motd === 'string') {
                  // 如果是字符串，直接清理格式代码
                  motdText = motdStatus.motd.replace(/§[0-9a-fk-or]/g, '').trim()
                } else if (typeof motdStatus.motd === 'object' && motdStatus.motd !== null) {
                  // 如果是对象，尝试提取clean字段
                  const motdObj = motdStatus.motd as any
                  if (motdObj.clean && typeof motdObj.clean === 'string') {
                    motdText = motdObj.clean.trim()
                  } else if (motdObj.text && typeof motdObj.text === 'string') {
                    motdText = motdObj.text.replace(/§[0-9a-fk-or]/g, '').trim()
                  } else {
                    // 尝试转换为字符串
                    try {
                      motdText = JSON.stringify(motdStatus.motd)
                    } catch {
                      motdText = ''
                    }
                  }
                }
                
                if (motdText) {
                  statusMessage += `${motdText}`
                }
              }
              
              return statusMessage
            } else {
              // 离线
              return `${config.name} 已离线`
            }
          } catch (error) {
            logger.error(`MOTD查询失败: ${error}`)
            return `${config.name} 状态查询失败`
          }
        } else {
          // 未启用MOTD查询
          return `${config.name} (MOTD查询未启用)`
        }
      } catch (error) {
        logger.error(`状态查询失败: ${error}`)
        return `状态查询失败: ${error.message}`
      }
    })

  // 注册mc.status子命令（兼容性）
  ctx.command('mc.status', '查看服务器状态')
    .action(async ({ session }) => {
      // 重定向到mc命令
      const result = await ctx.command('mc').execute({ session })
      return result
    })
}