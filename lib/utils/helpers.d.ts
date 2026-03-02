import { Config } from '../index';
import { Logger } from 'koishi';
/**
 * 根据群ID和可选的服务器ID获取对应的服务器配置
 * @param servers 所有服务器配置
 * @param guildId 当前群ID，格式可能为 'platform:groupId' 或纯数字
 * @param serverId 可选的服务器ID，如果提供则直接查找
 * @param debug 是否输出调试日志
 * @param logger 日志记录器
 * @returns 包含服务器对象或错误信息的对象
 */
export declare function getServerByGroup(servers: Config[], guildId: string, serverId?: string, debug?: boolean, logger?: Logger): {
    server: Config;
    error?: string;
} | {
    server: null;
    error: string;
};
/**
 * 判断用户是否在允许列表中（支持带平台前缀的QQ号）
 * @param userId 当前用户的ID（可能带平台前缀）
 * @param allowedList 配置中允许的ID列表（可能带前缀或纯数字）
 * @returns 是否允许
 */
export declare function isUserAllowed(userId: string, allowedList: string[]): boolean;
/**
 * 格式化群组ID用于广播
 * 如果群组ID是纯数字，添加默认平台前缀 'onebot:'
 * 如果已有平台前缀，保持不变
 * @param groupId 原始群组ID
 * @param defaultPlatform 默认平台前缀，默认为 'onebot'
 * @returns 格式化后的群组ID
 */
export declare function formatGroupIdForBroadcast(groupId: string, defaultPlatform?: string): string;
