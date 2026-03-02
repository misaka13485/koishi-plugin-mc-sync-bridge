/**
 * 根据群ID和可选的服务器ID获取对应的服务器配置
 * @param servers 所有服务器配置
 * @param guildId 当前群ID，格式可能为 'platform:groupId' 或纯数字
 * @param serverId 可选的服务器ID，如果提供则直接查找
 * @param debug 是否输出调试日志
 * @param logger 日志记录器
 * @returns 包含服务器对象或错误信息的对象
 */
export function getServerByGroup(servers, guildId, serverId, debug, logger) {
    // 如果传入了serverId，直接按ID查找
    if (serverId) {
        const server = servers.find(s => s.id === serverId);
        if (!server)
            return { server: null, error: `未找到ID为 ${serverId} 的服务器` };
        return { server };
    }
    // 调试日志
    if (debug && logger) {
        logger.debug(`当前群ID: ${guildId}`);
        logger.debug(`所有服务器群组配置: ${JSON.stringify(servers.map(s => ({ id: s.id, groups: s.groups })))}`);
    }
    // 从 guildId 中提取纯数字部分（如果有平台前缀）
    const guildParts = guildId.split(':');
    const realGuildId = guildParts.length > 1 ? guildParts[1] : guildId;
    const boundServers = servers.filter(s => s.groups.some(g => {
        // 1. 完全相等（包括平台前缀）
        if (g === guildId)
            return true;
        // 2. 从配置的群号中提取纯数字部分
        const gParts = g.split(':');
        const gNum = gParts.length > 1 ? gParts[1] : g;
        // 3. 比较纯数字部分
        return gNum === realGuildId;
    }));
    if (boundServers.length === 0) {
        return { server: null, error: '当前群未绑定任何服务器' };
    }
    if (boundServers.length > 1) {
        const ids = boundServers.map(s => s.id).join('、');
        return { server: null, error: `当前群绑定了多个服务器，请指定服务器ID (可用ID: ${ids})` };
    }
    return { server: boundServers[0] };
}
/**
 * 判断用户是否在允许列表中（支持带平台前缀的QQ号）
 * @param userId 当前用户的ID（可能带平台前缀）
 * @param allowedList 配置中允许的ID列表（可能带前缀或纯数字）
 * @returns 是否允许
 */
export function isUserAllowed(userId, allowedList) {
    if (!allowedList || allowedList.length === 0)
        return false;
    // 提取 userId 的数字部分
    const parts = userId.split(':');
    const realUserId = parts.length > 1 ? parts[1] : userId;
    return allowedList.some(allowed => {
        const allowedParts = allowed.split(':');
        const allowedNum = allowedParts.length > 1 ? allowedParts[1] : allowed;
        // 比较纯数字部分
        return allowedNum === realUserId;
    });
}
/**
 * 格式化群组ID用于广播
 * 如果群组ID是纯数字，添加默认平台前缀 'onebot:'
 * 如果已有平台前缀，保持不变
 * @param groupId 原始群组ID
 * @param defaultPlatform 默认平台前缀，默认为 'onebot'
 * @returns 格式化后的群组ID
 */
export function formatGroupIdForBroadcast(groupId, defaultPlatform = 'onebot') {
    // 如果已经包含平台前缀，直接返回
    if (groupId.includes(':')) {
        return groupId;
    }
    // 如果是纯数字，添加默认平台前缀
    if (/^\d+$/.test(groupId)) {
        return `${defaultPlatform}:${groupId}`;
    }
    // 其他情况（如特殊格式），直接返回
    return groupId;
}
