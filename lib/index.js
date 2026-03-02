"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const connection_1 = require("./connection");
const mcToQqHandler = __importStar(require("./handlers/mcToQq"));
const rconCommand = __importStar(require("./commands/rcon"));
const restartCommand = __importStar(require("./commands/restart"));
const listCommand = __importStar(require("./commands/list"));
const statusCommand = __importStar(require("./commands/status"));
exports.name = 'mc-sync-bridge';
exports.inject = ['database'];
// ========== Schema 定义 ==========
const QQToMcFilterSchema = koishi_1.Schema.object({
    enable: koishi_1.Schema.boolean().default(true),
    prefixes: koishi_1.Schema.array(koishi_1.Schema.string()).description('允许的前缀列表，消息必须以其中之一开头才转发（空=全部转发）').default([]),
});
const McToQqFilterSchema = koishi_1.Schema.object({
    enable: koishi_1.Schema.boolean().default(true),
    chat: koishi_1.Schema.boolean().description('转发玩家聊天消息').default(true),
    join: koishi_1.Schema.boolean().description('转发玩家加入消息').default(true),
    leave: koishi_1.Schema.boolean().description('转发玩家离开消息').default(true),
    death: koishi_1.Schema.boolean().description('转发玩家死亡消息').default(true),
    achievement: koishi_1.Schema.boolean().description('转发成就获得消息').default(true),
    prefixes: koishi_1.Schema.array(koishi_1.Schema.string()).description('允许的前缀列表（仅对聊天消息生效，空=全部转发）').default([]),
});
exports.Config = koishi_1.Schema.object({
    id: koishi_1.Schema.string().description('服务器唯一标识').required(),
    name: koishi_1.Schema.string().description('显示名称').required(),
    wsUrl: koishi_1.Schema.string().description('鹊桥 WebSocket 地址').required(),
    selfName: koishi_1.Schema.string().description('X-Self-Name 头').required(),
    wsToken: koishi_1.Schema.string().description('认证令牌 (Bearer)').default(''),
    groups: koishi_1.Schema.array(koishi_1.Schema.string())
        .description('绑定的QQ群号列表，支持格式：纯数字(922210161) 或 带平台前缀(onebot:922210161)')
        .default([]),
    filters: koishi_1.Schema.object({
        qqToMc: QQToMcFilterSchema,
        mcToQq: McToQqFilterSchema,
    }).default({
        qqToMc: { enable: true, prefixes: [] },
        mcToQq: { enable: true, chat: true, join: true, leave: true, death: true, achievement: true, prefixes: [] }
    }),
    admins: koishi_1.Schema.array(koishi_1.Schema.string())
        .description('管理员QQ号列表，支持格式：纯数字(1458753169) 或 带平台前缀(onebot:1458753169)')
        .default([]),
    reconnectInterval: koishi_1.Schema.number().description('重连间隔(ms)').default(30000),
    debug: koishi_1.Schema.boolean().description('输出调试日志').default(false),
    motd: koishi_1.Schema.object({
        enabled: koishi_1.Schema.boolean().description('启用MOTD查询').default(false),
        host: koishi_1.Schema.string().description('Minecraft服务器地址').default('localhost'),
        port: koishi_1.Schema.number().description('Minecraft服务器端口').default(25565),
    }).description('MOTD查询配置').default({
        enabled: false,
        host: 'localhost',
        port: 25565,
    }),
});
// ========== 插件入口 ==========
function apply(ctx, config) {
    const logger = ctx.logger('mc-bridge');
    logger.info(`插件已加载，服务器: ${config.name} (${config.id}), debug = ${config.debug}`);
    // 创建单个服务器连接
    const connection = new connection_1.ServerConnection(ctx, config, config.debug);
    connection.connect();
    // 加载子模块（传入单个配置和连接）
    mcToQqHandler.apply(ctx, config, connection, logger);
    rconCommand.apply(ctx, config, connection, logger);
    restartCommand.apply(ctx, config, connection, logger);
    listCommand.apply(ctx, config, connection, logger);
    statusCommand.apply(ctx, config, connection, logger);
    // QQ → MC 消息转发
    ctx.on('message', (session) => {
        if (!session.guildId)
            return;
        // 检查当前群是否属于此服务器
        const groupMatch = config.groups.some(g => {
            const parts = g.split(':');
            const gNum = parts.length > 1 ? parts[1] : g;
            const sessionParts = session.guildId.split(':');
            const sessionNum = sessionParts.length > 1 ? sessionParts[1] : session.guildId;
            return gNum === sessionNum;
        });
        if (!groupMatch)
            return;
        const filter = config.filters.qqToMc;
        if (!filter.enable)
            return;
        // 确定最终要发送的内容（可能去除前缀）
        let finalContent = session.content;
        if (filter.prefixes && filter.prefixes.length > 0) {
            const matchedPrefix = filter.prefixes.find(prefix => session.content.startsWith(prefix));
            if (!matchedPrefix)
                return;
            finalContent = session.content.slice(matchedPrefix.length).trimStart();
        }
        if (!finalContent)
            return;
        const success = connection.sendBroadcast(session.username, finalContent);
        if (!success && config.debug) {
            logger.debug('广播发送失败，服务器未连接');
        }
    });
    ctx.on('dispose', () => {
        connection.disconnect(true);
    });
}
