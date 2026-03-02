import { Context, Logger } from 'koishi';
import { Config } from '../index';
import { ServerConnection } from '../connection';
/**
 * 服务器状态命令处理器
 * 提供mc一级命令，显示服务器状态
 */
export declare function apply(ctx: Context, config: Config, connection: ServerConnection, logger: Logger): void;
