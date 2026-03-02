# 版本更新说明 v1.1.0

## ✨ 新功能

### 1. TPS性能监控
**命令**: `.mc list`
**功能**: 显示服务器TPS和MSPT性能指标
**输出示例**:
```
👥 在线玩家: 3/20
📋 hsc_1103, BHcczzz, DearVon

📊 服务器性能:
⚡ TPS: 20.00
⏱️  MSPT: 27.37 ms
✅ 性能优秀
```

**性能评级标准**:
- ✅ TPS ≥ 18: 性能优秀
- ⚠️ TPS ≥ 15: 性能良好
- ⚠️ TPS ≥ 10: 性能一般
- ❌ TPS < 10: 性能较差

### 2. MOTD查询优化
- 使用 `minecraft-server-util` 库替代自定义实现
- 更可靠的服务器状态检测
- 自动清理MOTD格式代码
- 支持多种MOTD格式（字符串、对象、extra数组）

### 3. 命令输出优化
**`.mc` 命令输出简化**:
```
🟢 GTL服务器
👥 3/20
📝 超级私货版GTL
```

**移除的内容**:
- 鹊桥连接状态显示
- 分隔线和冗余信息
- 命令用法提示

## 🔧 技术改进

### 1. TPS解析实现
- 并行执行 `list` 和 `forge tps` 命令
- 自动解析 `forge tps` 输出的Overall行
- 支持格式: `Overall: Mean tick time: 27.368 ms. Mean TPS: 20.000`

### 2. 连接状态管理优化
- 仅在重连成功时发送通知
- 主动断开（插件重启）不发送通知
- WebSocket断开时检查MOTD状态
- 简化MOTD配置（移除checkInterval和timeout）

### 3. 依赖更新
- 新增: `minecraft-server-util@^5.4.4`
- 更可靠的MOTD查询
- 更好的错误处理

## 📋 配置更新

### MOTD配置简化
**之前**:
```yaml
motd:
  enabled: true
  host: "localhost"
  port: 25565
  checkInterval: 10000  # 已移除
  timeout: 3000         # 已移除
```

**现在**:
```yaml
motd:
  enabled: true
  host: "localhost"
  port: 25565
```

### 命令使用说明
**`.mc`**: 查看服务器状态（MOTD信息）
**`.mc list`**: 查看在线玩家和服务器TPS性能
**`.mc rcon <命令>`**: 执行RCON命令
**`.mc restart`**: 重启Minecraft服务器
**`.mc status`**: 查看服务器状态（同.mc命令）

## 🐛 问题修复

1. **MOTD状态显示不正确**: 修复了缓冲区偏移量计算错误
2. **连接通知逻辑混乱**: 重构了连接状态通知机制
3. **TPS命令解析失败**: 更新了正则表达式匹配逻辑
4. **MOTD格式代码清理**: 改进了MOTD文本清理算法

## 📊 性能指标说明

### TPS (Ticks Per Second)
- **理想值**: 20.00
- **说明**: 每秒游戏刻数，20为满值
- **意义**: 衡量服务器运行流畅度

### MSPT (Milliseconds Per Tick)
- **理想值**: < 50ms
- **说明**: 每游戏刻耗时
- **意义**: 衡量服务器响应速度

## 🔍 调试支持

在 `config.debug = true` 时，会输出:
- MOTD查询原始结果
- TPS命令原始输出
- 连接状态变化日志
- 错误详细信息

## 🚀 升级指南

1. 更新插件版本: `npm install koishi-plugin-mc-sync-bridge@1.1.0`
2. 简化MOTD配置（移除checkInterval和timeout）
3. 测试新功能: `.mc list` 查看TPS性能
4. 验证MOTD查询: `.mc` 查看服务器状态

## 📞 问题反馈

如遇到问题，请提供:
1. 错误日志
2. 配置信息
3. `.mc list` 命令输出
4. 服务器版本信息