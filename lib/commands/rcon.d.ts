import { Context, Logger } from 'koishi';
import { Config } from '../index';
import { ServerConnection } from '../connection';
/**
 * 应用RCON命令处理器
 *
 * @param ctx - Koishi上下文对象
 * @param config - 插件配置
 * @param connection - 服务器连接对象
 * @param logger - 日志记录器
 */
export declare function apply(ctx: Context, config: Config, connection: ServerConnection, logger: Logger): void;
