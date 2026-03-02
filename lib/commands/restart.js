import { h } from 'koishi';
import { exec } from 'child_process';
import { promisify } from 'util';
import { isUserAllowed } from '../utils/helpers';
const execAsync = promisify(exec);
export function apply(ctx, config, connection, logger) {
    ctx.command('mc.restart', '重启MC服务器')
        .option('force', '-f, --force', { fallback: false })
        .option('kill', '-k, --kill', { fallback: false })
        .action(async ({ session, options }) => {
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
        if (!isUserAllowed(session.userId, config.admins))
            return '你没有权限执行重启';
        // 检查选项冲突
        if (options.force && options.kill) {
            return '不能同时使用 -f 和 -k 选项';
        }
        // 根据选项确定重启类型
        const restartType = options.force ? '强制重启' : options.kill ? '强制杀死' : '正常重启';
        if (!options.force && !options.kill) {
            // 正常重启：60秒倒计时
            await session.send(`⚠️ 服务器 ${config.name} 将在60秒后正常重启`);
            connection.sendBroadcast('系统', '⚠️ 服务器将在60秒后重启');
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
        else {
            // 强制重启/杀死：立即执行
            await session.send(`⚠️ 正在执行${restartType}操作: ${config.name}`);
        }
        // 再次确认连接是否仍然存在
        if (!connection) {
            await session.send('❌ 连接已断开，重启终止');
            return;
        }
        try {
            // 根据模式执行不同操作
            if (options.kill) {
                // 强制杀死模式：systemctl kill
                logger.info(`[${config.name}] 执行 systemctl kill`);
                // 断开WebSocket连接（静默）
                connection.disconnect(true);
                // 执行 systemctl kill -s SIGKILL
                const { stderr } = await execAsync('sudo systemctl kill -s SIGKILL mc-server');
                if (stderr) {
                    logger.warn(`systemctl kill stderr: ${stderr}`);
                }
                // 等待进程完全终止
                await new Promise(resolve => setTimeout(resolve, 2000));
                // 启动服务器
                const { stderr: startStderr } = await execAsync('sudo systemctl start mc-server');
                if (startStderr) {
                    logger.warn(`systemctl start stderr: ${startStderr}`);
                }
            }
            else if (options.force) {
                // 强制重启模式：systemctl restart
                logger.info(`[${config.name}] 执行 systemctl restart`);
                // 断开WebSocket连接（静默）
                connection.disconnect(true);
                const { stderr } = await execAsync('sudo systemctl restart mc-server');
                if (stderr) {
                    logger.warn(`systemctl restart stderr: ${stderr}`);
                }
            }
            else {
                // 正常重启模式
                logger.info(`[${config.name}] 执行正常重启`);
                // 广播最终重启消息
                connection.sendBroadcast('系统', '服务器即将重启');
                // 执行RCON命令安全关闭
                await connection.sendRcon('stop');
                // 断开WebSocket连接（静默）
                connection.disconnect(true);
            }
            // 等待服务器启动
            await connection.waitForConnect(120000); // 超时120秒
            await session.send(h('quote', { id: session.messageId }) + `✅ 服务器 ${config.name} ${restartType}完成`);
        }
        catch (err) {
            logger.error(`重启失败: ${err}`);
            await session.send(h('quote', { id: session.messageId }) + `❌ ${restartType}失败: ${err.message}`);
        }
    });
}
