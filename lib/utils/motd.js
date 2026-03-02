"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTDQuery = void 0;
const minecraft_server_util_1 = require("minecraft-server-util");
/**
 * Minecraft服务器ping查询工具
 * 使用minecraft-server-util库实现
 */
class MOTDQuery {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * 查询Minecraft服务器状态
     * @param host 服务器地址
     * @param port 服务器端口（默认25565）
     * @param timeout 超时时间（毫秒，默认3000）
     * @returns 服务器状态
     */
    async query(host, port = 25565, timeout = 3000) {
        try {
            // 使用minecraft-server-util查询服务器状态
            const options = {
                timeout,
                enableSRV: true // 启用SRV记录查询
            };
            const response = await (0, minecraft_server_util_1.status)(host, port, options);
            // 解析响应
            const result = {
                online: true,
                latency: response.roundTripLatency,
                version: response.version.name,
                motd: this.extractMotd(response.motd),
                players: {
                    online: response.players.online,
                    max: response.players.max
                }
            };
            this.logger.debug(`MOTD查询成功: ${host}:${port}, 延迟: ${result.latency}ms`);
            return result;
        }
        catch (error) {
            this.logger.warn(`MOTD查询失败: ${host}:${port} - ${error.message}`);
            // 返回离线状态
            return {
                online: false,
                error: error.message
            };
        }
    }
    /**
     * 提取MOTD文本
     * 处理不同格式的MOTD描述
     */
    extractMotd(description) {
        if (!description)
            return '';
        // 如果是字符串，直接返回
        if (typeof description === 'string') {
            return this.cleanMotd(description);
        }
        // 如果是对象，尝试提取文本
        if (typeof description === 'object') {
            // 优先使用clean字段（minecraft-server-util的格式）
            if (description.clean && typeof description.clean === 'string') {
                return description.clean.trim();
            }
            // 处理text字段
            if (description.text && typeof description.text === 'string') {
                return this.cleanMotd(description.text);
            }
            // 处理extra数组
            if (Array.isArray(description.extra)) {
                const texts = description.extra
                    .map((item) => item.text || '')
                    .filter((text) => text)
                    .join('');
                return this.cleanMotd(texts);
            }
            // 尝试提取raw字段
            if (description.raw && typeof description.raw === 'string') {
                return this.cleanMotd(description.raw);
            }
            // 尝试转换为字符串
            try {
                const str = JSON.stringify(description);
                // 如果是JSON对象字符串，尝试解析其中的clean字段
                if (str.includes('"clean"')) {
                    try {
                        const parsed = JSON.parse(str);
                        if (parsed.clean && typeof parsed.clean === 'string') {
                            return parsed.clean.trim();
                        }
                    }
                    catch {
                        // 如果解析失败，继续使用原始字符串
                    }
                }
                return this.cleanMotd(str);
            }
            catch {
                return '';
            }
        }
        return '';
    }
    /**
     * 清理MOTD文本
     * 移除Minecraft格式代码和多余空格
     */
    cleanMotd(motd) {
        if (!motd)
            return '';
        // 移除Minecraft格式代码 (§[0-9a-fk-or])
        let cleaned = motd.replace(/§[0-9a-fk-or]/g, '');
        // 移除多余空格和换行
        cleaned = cleaned.trim();
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned;
    }
    /**
     * 简化查询方法（仅检查服务器是否在线）
     */
    async isServerOnline(host, port = 25565, timeout = 3000) {
        try {
            const status = await this.query(host, port, timeout);
            return status.online;
        }
        catch (error) {
            this.logger.warn(`MOTD查询失败: ${error.message}`);
            return false;
        }
    }
}
exports.MOTDQuery = MOTDQuery;
