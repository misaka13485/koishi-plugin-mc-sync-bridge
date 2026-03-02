import { Logger } from 'koishi';
/**
 * Minecraft服务器状态查询结果
 */
export interface ServerStatus {
    online: boolean;
    version?: string;
    motd?: string;
    players?: {
        online: number;
        max: number;
    };
    latency?: number;
    error?: string;
}
/**
 * Minecraft服务器ping查询工具
 * 使用minecraft-server-util库实现
 */
export declare class MOTDQuery {
    private logger;
    constructor(logger: Logger);
    /**
     * 查询Minecraft服务器状态
     * @param host 服务器地址
     * @param port 服务器端口（默认25565）
     * @param timeout 超时时间（毫秒，默认3000）
     * @returns 服务器状态
     */
    query(host: string, port?: number, timeout?: number): Promise<ServerStatus>;
    /**
     * 提取MOTD文本
     * 处理不同格式的MOTD描述
     */
    private extractMotd;
    /**
     * 清理MOTD文本
     * 移除Minecraft格式代码和多余空格
     */
    private cleanMotd;
    /**
     * 简化查询方法（仅检查服务器是否在线）
     */
    isServerOnline(host: string, port?: number, timeout?: number): Promise<boolean>;
}
