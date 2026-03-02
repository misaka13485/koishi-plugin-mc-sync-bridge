import { Context, Schema } from 'koishi'
import { ServerConnection } from './connection'
import * as mcToQqHandler from './handlers/mcToQq'
import * as rconCommand from './commands/rcon'
import * as restartCommand from './commands/restart'
import * as listCommand from './commands/list'
import * as statusCommand from './commands/status'

// 扩展事件类型（简化，不再需要 serverId）
declare module 'koishi' {
  interface Events {
    'mc-bridge/mc-message'(msg: any): void
  }
}

export const name = 'mc-sync-bridge'
export const inject = ['database']

// ========== 过滤配置 ==========
export interface QQToMcFilter {
  enable: boolean
  prefixes?: string[]   // 消息必须以这些前缀之一开头才转发（空数组表示全部转发）
}

export interface McToQqFilter {
  enable: boolean
  chat?: boolean          // 玩家聊天
  join?: boolean          // 玩家加入
  leave?: boolean         // 玩家离开
  death?: boolean         // 玩家死亡
  achievement?: boolean   // 获得成就
  prefixes?: string[]
}

// ========== 单服务器配置 ==========
export interface Config {
  id: string
  name: string
  wsUrl: string
  selfName: string
  wsToken?: string
  groups: string[]
  filters: {
    qqToMc: QQToMcFilter
    mcToQq: McToQqFilter
  }
  admins: string[]
  reconnectInterval: number
  debug: boolean
  // MOTD查询配置
  motd?: {
    enabled: boolean
    host: string
    port: number
  }
}

// ========== Schema 定义 ==========
const QQToMcFilterSchema = Schema.object({
  enable: Schema.boolean().default(true),
  prefixes: Schema.array(Schema.string()).description('允许的前缀列表，消息必须以其中之一开头才转发（空=全部转发）').default([]),
})

const McToQqFilterSchema = Schema.object({
  enable: Schema.boolean().default(true),
  chat: Schema.boolean().description('转发玩家聊天消息').default(true),
  join: Schema.boolean().description('转发玩家加入消息').default(true),
  leave: Schema.boolean().description('转发玩家离开消息').default(true),
  death: Schema.boolean().description('转发玩家死亡消息').default(true),
  achievement: Schema.boolean().description('转发成就获得消息').default(true),
  prefixes: Schema.array(Schema.string()).description('允许的前缀列表（仅对聊天消息生效，空=全部转发）').default([]),
})

export const Config: Schema<Config> = Schema.object({
  id: Schema.string().description('服务器唯一标识').required(),
  name: Schema.string().description('显示名称').required(),
  wsUrl: Schema.string().description('鹊桥 WebSocket 地址').required(),
  selfName: Schema.string().description('X-Self-Name 头').required(),
  wsToken: Schema.string().description('认证令牌 (Bearer)').default(''),
  groups: Schema.array(Schema.string())
    .description('绑定的QQ群号列表，支持格式：纯数字(922210161) 或 带平台前缀(onebot:922210161)')
    .default([]),
  filters: Schema.object({
    qqToMc: QQToMcFilterSchema,
    mcToQq: McToQqFilterSchema,
  }).default({
    qqToMc: { enable: true, prefixes: [] },
    mcToQq: { enable: true, chat: true, join: true, leave: true, death: true, achievement: true, prefixes: [] }
  }),
  admins: Schema.array(Schema.string())
    .description('管理员QQ号列表，支持格式：纯数字(1458753169) 或 带平台前缀(onebot:1458753169)')
    .default([]),
  reconnectInterval: Schema.number().description('重连间隔(ms)').default(30000),
  debug: Schema.boolean().description('输出调试日志').default(false),
  motd: Schema.object({
    enabled: Schema.boolean().description('启用MOTD查询').default(false),
    host: Schema.string().description('Minecraft服务器地址').default('localhost'),
    port: Schema.number().description('Minecraft服务器端口').default(25565),
  }).description('MOTD查询配置').default({
    enabled: false,
    host: 'localhost',
    port: 25565,
  }),
})

// ========== 插件入口 ==========
export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('mc-bridge')
  logger.info(`插件已加载，服务器: ${config.name} (${config.id}), debug = ${config.debug}`)

  // 创建单个服务器连接
  const connection = new ServerConnection(ctx, config, config.debug)
  connection.connect()

  // 加载子模块（传入单个配置和连接）
  mcToQqHandler.apply(ctx, config, connection, logger)
  rconCommand.apply(ctx, config, connection, logger)
  restartCommand.apply(ctx, config, connection, logger)
  listCommand.apply(ctx, config, connection, logger)
  statusCommand.apply(ctx, config, connection, logger)

  // QQ → MC 消息转发
  ctx.on('message', (session) => {
    if (!session.guildId) return

    // 检查当前群是否属于此服务器
    const groupMatch = config.groups.some(g => {
      const parts = g.split(':')
      const gNum = parts.length > 1 ? parts[1] : g
      const sessionParts = session.guildId.split(':')
      const sessionNum = sessionParts.length > 1 ? sessionParts[1] : session.guildId
      return gNum === sessionNum
    })
    if (!groupMatch) return

    const filter = config.filters.qqToMc
    if (!filter.enable) return

    // 确定最终要发送的内容（可能去除前缀）
    let finalContent = session.content
    if (filter.prefixes && filter.prefixes.length > 0) {
      const matchedPrefix = filter.prefixes.find(prefix => session.content.startsWith(prefix))
      if (!matchedPrefix) return
      finalContent = session.content.slice(matchedPrefix.length).trimStart()
    }
    if (!finalContent) return

    const success = connection.sendBroadcast(session.username, finalContent)
    if (!success && config.debug) {
      logger.debug('广播发送失败，服务器未连接')
    }
  })

  ctx.on('dispose', () => {
    connection.disconnect(true)
  })
}