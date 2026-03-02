import WebSocket from 'ws';
import { formatGroupIdForBroadcast } from './utils/helpers';
/**
 * Minecraft 服务器连接管理器
 * 负责与 Minecraft 服务器的 WebSocket 连接管理、消息收发和重连逻辑
 */
export class ServerConnection {
    ws = null;
    reconnectTimer = null;
    ctx;
    config;
    debug;
    pendingRcon = new Map();
    hasConnectedOnce = false;
    _disconnecting = false;
    _destroyed = false;
    _connectWait = null;
    _connectWaitTimer = null;
    /**
     * 创建服务器连接实例
     * @param ctx Koishi 上下文
     * @param config 服务器配置
     * @param debug 是否启用调试模式
     */
    constructor(ctx, config, debug) {
        this.ctx = ctx;
        this.config = config;
        this.debug = debug;
    }
    /**
     * 连接到 Minecraft 服务器
     * 建立 WebSocket 连接并设置事件监听器
     */
    connect() {
        if (this._destroyed) {
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] 尝试连接已销毁的实例，忽略`);
            return;
        }
        if (this.ws?.readyState === WebSocket.OPEN)
            return;
        // 重置主动断开标志，准备新连接
        this._disconnecting = false;
        this.ctx.logger('mc-bridge').info(`[${this.config.name}] 正在连接 WebSocket...`);
        const options = { family: 4 };
        const headers = {};
        // 设置认证头
        if (this.config.wsToken) {
            headers['Authorization'] = `Bearer ${this.config.wsToken}`;
        }
        if (this.config.selfName) {
            headers['X-Self-Name'] = this.config.selfName;
        }
        else {
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] selfName 未配置，可能被服务器拒绝`);
        }
        if (Object.keys(headers).length > 0) {
            options.headers = headers;
        }
        if (this.debug) {
            this.ctx.logger('mc-bridge').debug(`[${this.config.name}] WebSocket 选项: %o`, options);
        }
        this.ws = new WebSocket(this.config.wsUrl, options);
        // 连接成功事件
        this.ws.on('open', () => {
            if (this._destroyed)
                return;
            this.ctx.logger('mc-bridge').info(`[${this.config.name}] 已连接`);
            // 重连成功时发送通知（仅当非首次连接且不是主动断开）
            if (this.hasConnectedOnce && !this._disconnecting) {
                this.notifyGroups(`✅ 服务器 ${this.config.name} 已重新连接`);
            }
            else {
                this.hasConnectedOnce = true;
            }
            // 清理重连定时器
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // 如果有等待连接的 Promise，则解析它
            if (this._connectWait) {
                this._connectWait.resolve();
                this._cleanupConnectWait();
            }
        });
        // 消息接收事件
        this.ws.on('message', (data) => {
            if (this._destroyed)
                return;
            this.handleMessage(data.toString());
        });
        // 连接关闭事件
        this.ws.on('close', (code, reason) => {
            if (this._destroyed)
                return;
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] 连接关闭: ${code} ${reason}`);
            this.ws = null;
            // 如果不是主动断开，且之前曾连接成功，则发送断开通知
            if (!this._disconnecting && this.hasConnectedOnce) {
                this.notifyGroups(`❌ 服务器 ${this.config.name} 连接断开`);
            }
            this.scheduleReconnect();
            // 重置主动断开标志，以便下次连接
            this._disconnecting = false;
        });
        // 错误事件
        this.ws.on('error', (err) => {
            if (this._destroyed)
                return;
            this.ctx.logger('mc-bridge').error(`[${this.config.name}] 错误: ${err.message}`);
        });
    }
    /**
     * 断开与服务器的连接
     * @param silent 是否静默断开（不发送通知）
     */
    disconnect(silent = false) {
        this._destroyed = true;
        if (silent) {
            this._disconnecting = true;
        }
        // 清理等待中的连接 Promise
        if (this._connectWait) {
            this._connectWait.reject(new Error('连接被主动断开'));
            this._connectWait = null;
        }
        if (this._connectWaitTimer) {
            clearTimeout(this._connectWaitTimer);
            this._connectWaitTimer = null;
        }
        // 清理重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // 关闭 WebSocket 连接
        if (this.ws) {
            // 移除所有监听器，避免后续事件触发
            this.ws.removeAllListeners();
            const state = this.ws.readyState;
            // 仅当已连接时正常关闭
            if (state === WebSocket.OPEN) {
                try {
                    this.ws.close();
                }
                catch (e) {
                    if (this.debug) {
                        this.ctx.logger('mc-bridge').debug(`[${this.config.name}] 断开连接时忽略错误: ${e.message}`);
                    }
                }
            }
            // 对于 CONNECTING 或 CLOSING/CLOSED 状态，不主动关闭，避免异常
            this.ws = null;
        }
    }
    /**
     * 发送消息到 Minecraft 服务器
     * @param type 消息类型
     * @param data 消息数据
     * @param requestId 请求ID（用于异步响应）
     * @returns 是否发送成功
     */
    sendToMc(type, data, requestId) {
        if (this._destroyed)
            return false;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] 未连接，无法发送`);
            return false;
        }
        const payload = { type, data };
        if (requestId)
            payload.requestId = requestId;
        this.ws.send(JSON.stringify(payload));
        return true;
    }
    /**
     * 发送任意格式的原始消息到 Minecraft 服务器
     * 用于 RCON 等需要特殊格式的消息
     * @param payload 原始消息对象
     * @returns 是否发送成功
     */
    sendToMcRaw(payload) {
        if (this._destroyed)
            return false;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] 未连接，无法发送`);
            return false;
        }
        this.ws.send(JSON.stringify(payload));
        return true;
    }
    /**
     * 发送 RCON 命令到 Minecraft 服务器
     * 根据鹊桥 API 使用特定格式，支持异步响应
     * @param command RCON 命令字符串
     * @param timeout 超时时间（毫秒），默认 10 秒
     * @returns Promise 解析为命令执行结果
     */
    sendRcon(command, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (this._destroyed) {
                reject(new Error('连接已销毁'));
                return;
            }
            const requestId = `rcon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.pendingRcon.set(requestId, resolve);
            this.ctx.logger('mc-bridge').debug(`[${this.config.name}] 发送RCON命令: ${command}, requestId: ${requestId}`);
            const payload = {
                api: "send_rcon_command",
                data: { command },
                echo: requestId
            };
            if (!this.sendToMcRaw(payload)) {
                this.pendingRcon.delete(requestId);
                reject(new Error('WebSocket未连接'));
                return;
            }
            // 设置超时处理
            const timeoutId = setTimeout(() => {
                if (this.pendingRcon.has(requestId)) {
                    this.pendingRcon.delete(requestId);
                    this.ctx.logger('mc-bridge').warn(`[${this.config.name}] RCON命令超时: ${command}`);
                    reject(new Error(`RCON命令超时 (${timeout}ms)`));
                }
            }, timeout);
            // 清理超时定时器（当Promise被解析或拒绝时）
            const cleanup = () => {
                clearTimeout(timeoutId);
            };
            // 确保超时定时器被清理
            Promise.resolve().then(() => { }).finally(cleanup);
        });
    }
    /**
     * 处理从 Minecraft 服务器收到的 WebSocket 消息
     * @param raw 原始消息字符串
     */
    handleMessage(raw) {
        if (this._destroyed)
            return;
        if (this.debug) {
            this.ctx.logger('mc-bridge').info(`[${this.config.name}] 收到原始消息: ${raw}`);
        }
        try {
            const msg = JSON.parse(raw);
            this.ctx.logger('mc-bridge').debug(`[${this.config.name}] 收到解析消息: %o`, msg);
            // 处理 RCON 响应
            if (msg.echo && this.pendingRcon.has(msg.echo)) {
                const callback = this.pendingRcon.get(msg.echo);
                this.pendingRcon.delete(msg.echo);
                if (msg.status === 'SUCCESS') {
                    callback?.(msg.data);
                }
                else {
                    callback?.(`[错误] ${msg.message || '未知错误'}`);
                }
                return;
            }
            // 触发普通消息事件
            this.ctx.emit('mc-bridge/mc-message', msg);
        }
        catch (err) {
            this.ctx.logger('mc-bridge').error(`[${this.config.name}] 消息解析失败: ${err.message}`);
            if (this.debug) {
                this.ctx.logger('mc-bridge').debug(`[${this.config.name}] 原始消息内容: ${raw}`);
            }
        }
    }
    /**
     * 向配置的 QQ 群组发送通知消息
     * @param text 通知文本内容
     */
    notifyGroups(text) {
        if (this._destroyed)
            return;
        if (!this.ctx.database) {
            this.ctx.logger('mc-bridge').warn(`数据库未就绪，无法发送通知: ${text}`);
            return;
        }
        for (const groupId of this.config.groups) {
            const formattedGroupId = formatGroupIdForBroadcast(groupId);
            this.ctx.broadcast([formattedGroupId], text);
        }
    }
    /**
     * 安排重连任务
     * 在连接断开后延迟一段时间重新连接
     */
    scheduleReconnect() {
        if (this._destroyed)
            return;
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            if (this._destroyed)
                return;
            this.ctx.logger('mc-bridge').info(`[${this.config.name}] 尝试重连...`);
            this.connect();
        }, this.config.reconnectInterval);
    }
    /**
     * 发送广播消息到 Minecraft 服务器（用于 QQ 消息转发）
     * @param qqNick QQ 昵称
     * @param content 消息内容
     * @returns 是否发送成功
     */
    sendBroadcast(qqNick, content) {
        if (this._destroyed)
            return false;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.ctx.logger('mc-bridge').warn(`[${this.config.name}] 未连接，无法发送广播`);
            return false;
        }
        const payload = {
            api: "broadcast",
            data: {
                message: [
                    { text: `[${qqNick}]`, color: "aqua" }, // 蓝色
                    { text: content, color: "white" } // 白色
                ]
            }
        };
        // 可选添加 echo 用于调试，但不需要等待响应
        if (this.debug) {
            payload.echo = `broadcast_${Date.now()}`;
            this.ctx.logger('mc-bridge').debug(`[${this.config.name}] 发送广播: %o`, payload);
        }
        this.ws.send(JSON.stringify(payload));
        return true;
    }
    /**
     * 等待 WebSocket 连接成功
     * 用于服务器重启等需要等待连接就绪的场景
     * @param timeout 超时时间（毫秒），默认 60 秒
     * @returns Promise，连接成功时解析
     */
    waitForConnect(timeout = 60000) {
        // 如果已经连接，立即成功
        if (this.ws?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            this._connectWait = { resolve, reject };
            this._connectWaitTimer = setTimeout(() => {
                if (this._connectWait) {
                    this._connectWait.reject(new Error('等待服务器连接超时'));
                    this._connectWait = null;
                    this._connectWaitTimer = null;
                }
            }, timeout);
        });
    }
    /**
     * 清理连接等待状态
     * 在连接成功或失败时调用
     */
    _cleanupConnectWait() {
        if (this._connectWaitTimer) {
            clearTimeout(this._connectWaitTimer);
            this._connectWaitTimer = null;
        }
        this._connectWait = null;
    }
}
