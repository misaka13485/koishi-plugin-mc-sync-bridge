"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply = apply;
const helpers_1 = require("../utils/helpers");
function apply(ctx, config, connection, logger) {
    ctx.on('mc-bridge/mc-message', (msg) => {
        const filter = config.filters.mcToQq;
        if (!filter.enable)
            return;
        // 事件类型过滤
        let eventAllowed = true;
        if (msg.post_type === 'notice') {
            switch (msg.event_name) {
                case 'PlayerJoinEvent':
                    eventAllowed = filter.join !== false;
                    break;
                case 'PlayerQuitEvent':
                    eventAllowed = filter.leave !== false;
                    break;
                case 'PlayerDeathEvent':
                    eventAllowed = filter.death !== false;
                    break;
                case 'PlayerAchievementEvent':
                    eventAllowed = filter.achievement !== false;
                    break;
                default:
                    eventAllowed = false;
            }
        }
        else if (msg.post_type === 'message') {
            if (msg.event_name === 'PlayerChatEvent') {
                eventAllowed = filter.chat !== false;
            }
            else {
                eventAllowed = false;
            }
        }
        else {
            eventAllowed = false;
        }
        if (!eventAllowed)
            return;
        // 聊天消息前缀过滤
        if (msg.post_type === 'message' && msg.event_name === 'PlayerChatEvent') {
            const content = msg.message || msg.raw_message || '';
            if (filter.prefixes && filter.prefixes.length > 0) {
                const matches = filter.prefixes.some(prefix => content.startsWith(prefix));
                if (!matches)
                    return;
            }
        }
        // 格式化为可读文本
        const text = formatMessage(config.name, msg, logger, config.debug);
        if (!text)
            return;
        // 调试输出最终消息
        if (config.debug) {
            logger.info(`[${config.name}] 发送到QQ群: ${text}`);
        }
        // 发送到绑定的QQ群
        for (const groupId of config.groups) {
            const formattedGroupId = (0, helpers_1.formatGroupIdForBroadcast)(groupId);
            ctx.broadcast([formattedGroupId], text);
        }
    });
}
/**
 * 格式化消息为可读文本（适配鹊桥 v0.4.1+）
 * @param serverName 服务器显示名称
 * @param msg 鹊桥消息对象
 * @param logger 日志记录器
 * @param debug 是否调试模式
 * @returns 格式化后的字符串，null 表示忽略
 */
function formatMessage(serverName, msg, logger, debug) {
    const prefix = `[${serverName}]`;
    // 1. 处理通知事件 (post_type = 'notice')
    if (msg.post_type === 'notice') {
        const player = msg.player;
        const playerName = player?.nickname || player?.name || '未知玩家';
        switch (msg.event_name) {
            case 'PlayerJoinEvent': {
                const x = player?.x !== undefined ? Math.floor(player.x) : '?';
                const y = player?.y !== undefined ? Math.floor(player.y) : '?';
                const z = player?.z !== undefined ? Math.floor(player.z) : '?';
                return `${prefix} ${playerName} 加入了游戏 位于 (${x}, ${y}, ${z})`;
            }
            case 'PlayerQuitEvent':
                return `${prefix} ${playerName} 离开了游戏`;
            case 'PlayerDeathEvent': {
                const deathText = msg.death?.text;
                if (!deathText) {
                    logger.warn(`[${serverName}] 死亡消息缺少 text 字段: ${JSON.stringify(msg.death)}`);
                    return null;
                }
                if (deathText.includes('%') || /^[a-z]+\.[a-z]+\.[a-z]+/.test(deathText)) {
                    logger.warn(`[${serverName}] 死亡消息可能未翻译: ${deathText}`);
                }
                return `${prefix} ${deathText}`;
            }
            case 'PlayerAchievementEvent': {
                const achievementText = msg.achievement?.translation?.text ||
                    msg.achievement?.translate?.text ||
                    msg.achievement?.text;
                if (!achievementText) {
                    logger.warn(`[${serverName}] 成就消息缺少文本字段: ${JSON.stringify(msg.achievement)}`);
                    return null;
                }
                if (debug) {
                    logger.debug(`[${serverName}] 成就消息文本: ${achievementText}`);
                }
                if (achievementText.includes('%') || /^[a-z]+\.[a-z]+\.[a-z]+/.test(achievementText)) {
                    logger.warn(`[${serverName}] 成就消息可能未翻译: ${achievementText}`);
                }
                return `${prefix} ${achievementText}`;
            }
            default:
                return null;
        }
    }
    // 2. 处理消息事件 (post_type = 'message')
    if (msg.post_type === 'message') {
        const playerName = msg.player?.nickname || msg.player?.name || '未知玩家';
        switch (msg.event_name) {
            case 'PlayerChatEvent': {
                const chatContent = msg.message || msg.raw_message || '';
                // 确保包含玩家名
                return `${prefix} ${playerName}: ${chatContent}`;
            }
            case 'PlayerCommandEvent': {
                const command = msg.command || '';
                return `${prefix} ${playerName} 执行命令: /${command}`;
            }
            default:
                return null;
        }
    }
    // 3. 兼容旧版格式（type 字段，如 bridge 旧版）
    if (msg.type) {
        const { type, data } = msg;
        switch (type) {
            case 'chat':
                return `${prefix} <${data.player}> ${data.message}`;
            case 'system':
                return `${prefix} ${data.content}`;
            case 'join':
                return `${prefix} ${data.player} 加入了游戏`;
            case 'leave':
                return `${prefix} ${data.player} 离开了游戏`;
            case 'death':
                return `${prefix} ${data.player} ${data.message}`;
            default:
                return null;
        }
    }
    // 4. 无法识别的消息，忽略
    return null;
}
