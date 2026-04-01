import { Context } from 'koishi';
import { Config } from './index';
import { ServerStatus } from './utils/motd';
/**
 * Minecraft 服务器连接管理器
 * 负责与 Minecraft 服务器的 WebSocket 连接管理、消息收发和重连逻辑
 */
export declare class ServerConnection {
    private ws;
    private reconnectTimer;
    private ctx;
    private config;
    private debug;
    private pendingRcon;
    private hasConnectedOnce;
    private _disconnecting;
    private _destroyed;
    private _disconnectedNotified;
    private motdQuery;
    private lastMotdStatus;
    private _connectWait;
    private _connectWaitTimer;
    /**
     * 创建服务器连接实例
     * @param ctx Koishi 上下文
     * @param config 服务器配置
     * @param debug 是否启用调试模式
     */
    constructor(ctx: Context, config: Config, debug: boolean);
    /**
     * 连接到 Minecraft 服务器
     * 建立 WebSocket 连接并设置事件监听器
     */
    connect(): void;
    /**
     * 断开与服务器的连接
     * 注意：此方法仅在插件关闭时调用，会阻止后续所有重连尝试
     * @param silent 是否静默断开（不发送通知）
     */
    disconnect(silent?: boolean): void;
    /**
     * 发送消息到 Minecraft 服务器
     * @param type 消息类型
     * @param data 消息数据
     * @param requestId 请求ID（用于异步响应）
     * @returns 是否发送成功
     */
    sendToMc(type: string, data: any, requestId?: string): boolean;
    /**
     * 发送任意格式的原始消息到 Minecraft 服务器
     * 用于 RCON 等需要特殊格式的消息
     * @param payload 原始消息对象
     * @returns 是否发送成功
     */
    sendToMcRaw(payload: any): boolean;
    /**
     * 发送 RCON 命令到 Minecraft 服务器
     * 根据鹊桥 API 使用特定格式，支持异步响应
     * @param command RCON 命令字符串
     * @param timeout 超时时间（毫秒），默认 10 秒
     * @returns Promise 解析为命令执行结果
     */
    sendRcon(command: string, timeout?: number): Promise<any>;
    /**
     * 处理从 Minecraft 服务器收到的 WebSocket 消息
     * @param raw 原始消息字符串
     */
    private handleMessage;
    /**
     * 向配置的 QQ 群组发送通知消息
     * @param text 通知文本内容
     */
    private notifyGroups;
    /**
     * 安排重连任务
     * 在连接断开或失败后延迟一段时间重新连接，使用简单的轮询机制
     * 注意：此方法会无限重连，直到插件被销毁
     */
    private scheduleReconnect;
    /**
     * 发送广播消息到 Minecraft 服务器（用于 QQ 消息转发）
     * @param qqNick QQ 昵称
     * @param content 消息内容
     * @returns 是否发送成功
     */
    sendBroadcast(qqNick: string, content: string): boolean;
    /**
     * 等待 WebSocket 连接成功
     * 用于服务器重启等需要等待连接就绪的场景
     * @param timeout 超时时间（毫秒），默认 60 秒
     * @returns Promise，连接成功时解析
     */
    waitForConnect(timeout?: number): Promise<void>;
    /**
     * 清理连接等待状态
     * 在连接成功或失败时调用
     */
    private _cleanupConnectWait;
    /**
     * 检查服务器状态（一次性检查）
     * 在WebSocket断开连接时调用，用于判断服务器是否真的宕机
     */
    private checkServerStatusOnce;
    /**
     * 查询服务器MOTD状态
     * 用于命令查询
     */
    queryMotdStatus(): Promise<ServerStatus>;
    /**
     * 获取鹊桥连接状态
     */
    getWebSocketStatus(): 'connected' | 'disconnected' | 'connecting' | 'destroyed';
    /**
     * 获取最后已知的MOTD状态
     */
    getLastMotdStatus(): ServerStatus | null;
}
