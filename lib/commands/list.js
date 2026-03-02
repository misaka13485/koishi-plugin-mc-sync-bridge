export function apply(ctx, config, connection, logger) {
    ctx.command('mc.list', '查看MC服务器在线玩家')
        .action(async ({ session }) => {
        if (!session.guildId)
            return '请在群聊中使用';
        // 检查当前群是否属于此服务器
        const groupMatch = config.groups.some(g => {
            const parts = g.split(':');
            const gNum = parts.length > 1 ? parts[1] : g;
            const sessionParts = session.guildId.split(':');
            const sessionNum = sessionParts.length > 1 ? sessionParts[1] : session.guildId;
            return gNum === sessionNum;
        });
        if (!groupMatch)
            return '当前群未绑定此服务器';
        try {
            const rconResult = await connection.sendRcon('list');
            // 增强正则：允许任意空白，可选的冒号，支持跨行（添加 s 标志）
            const match = rconResult.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/is);
            if (match) {
                const current = match[1];
                const max = match[2];
                const players = match[3].trim();
                return `在线玩家: ${current}/${max}\n${players || '无'}`;
            }
            else {
                // 调试模式下输出未匹配的原始结果
                if (config.debug) {
                    logger.debug(`[${config.name}] list命令返回未匹配: ${rconResult}`);
                }
                return `在线状态:\n${rconResult}`;
            }
        }
        catch (err) {
            return `获取在线玩家失败: ${err.message}`;
        }
    });
}
