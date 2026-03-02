"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply = apply;
function apply(ctx, config, connection, logger) {
    ctx.command('mc.list', '查看MC服务器在线玩家和性能指标')
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
            // 并行获取玩家列表和TPS信息
            const [listResult, tpsResult] = await Promise.allSettled([
                connection.sendRcon('list'),
                connection.sendRcon('forge tps')
            ]);
            let resultMessage = '';
            // 处理玩家列表结果
            if (listResult.status === 'fulfilled') {
                const rconResult = listResult.value;
                // 增强正则：允许任意空白，可选的冒号，支持跨行（添加 s 标志）
                const match = rconResult.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/is);
                if (match) {
                    const current = match[1];
                    const max = match[2];
                    const players = match[3].trim();
                    resultMessage += `👥 在线玩家: ${current}/${max}\n`;
                    if (players) {
                        resultMessage += `${players}\n`;
                    }
                }
                else {
                    // 调试模式下输出未匹配的原始结果
                    if (config.debug) {
                        logger.debug(`[${config.name}] list命令返回未匹配: ${rconResult}`);
                    }
                    resultMessage += `📋 在线状态:\n${rconResult}\n`;
                }
            }
            else {
                resultMessage += `❌ 获取玩家列表失败\n`;
            }
            // 处理TPS结果
            if (tpsResult.status === 'fulfilled') {
                const tpsOutput = tpsResult.value;
                // 解析TPS和MSPT信息
                const tpsInfo = parseTPSOutput(tpsOutput, logger, config);
                if (tpsInfo) {
                    resultMessage += `\n📊 性能指标:\n`;
                    resultMessage += `⚡ TPS: ${tpsInfo.tps}\n`;
                    resultMessage += `⏱️  MSPT: ${tpsInfo.mspt}\n`;
                    // 添加性能状态指示
                    const tpsNum = parseFloat(tpsInfo.tps);
                }
                else {
                    resultMessage += `\n📊 性能指标: 解析失败\n`;
                    if (config.debug) {
                        logger.debug(`[${config.name}] TPS命令返回: ${tpsOutput}`);
                    }
                }
            }
            else {
                resultMessage += `\n📊 性能指标: 获取失败\n`;
                if (config.debug) {
                    logger.debug(`[${config.name}] TPS命令失败: ${tpsResult.reason}`);
                }
            }
            return resultMessage.trim();
        }
        catch (err) {
            logger.error(`[${config.name}] list命令执行失败: ${err.message}`);
            return `获取服务器信息失败: ${err.message}`;
        }
    });
}
/**
 * 解析Forge TPS命令输出
 * 只解析Overall行的TPS和MSPT信息
 * 实际输出格式:
 * Overall: Mean tick time: 27.368 ms. Mean TPS: 20.000
 * Dim minecraft:overworld (minecraft:overworld): Mean tick time: 1.152 ms. Mean TPS: 20.000
 * ...
 */
function parseTPSOutput(output, logger, config) {
    try {
        // 查找Overall行 - 匹配实际格式: "Overall: Mean tick time: 27.368 ms. Mean TPS: 20.000"
        const overallMatch = output.match(/Overall:\s*Mean tick time:\s*([\d.]+)\s*ms\.\s*Mean TPS:\s*([\d.]+)/i);
        if (overallMatch) {
            const mspt = parseFloat(overallMatch[1]).toFixed(2);
            const tps = parseFloat(overallMatch[2]).toFixed(2);
            if (config.debug) {
                logger.debug(`[${config.name}] 解析TPS成功: ${tps} TPS, ${mspt} MSPT`);
            }
            return { tps, mspt };
        }
        // 如果没有找到Overall行，返回null
        if (config.debug) {
            logger.debug(`[${config.name}] 未找到Overall TPS信息: ${output}`);
        }
        return null;
    }
    catch (error) {
        logger.error(`[${config.name}] 解析TPS输出失败: ${error.message}`);
        return null;
    }
}
