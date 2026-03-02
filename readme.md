# koishi-plugin-mc-sync-bridge

[![npm](https://img.shields.io/npm/v/koishi-plugin-mc-sync-bridge?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-mc-sync-bridge)
[![license](https://img.shields.io/npm/l/koishi-plugin-mc-sync-bridge?style=flat-square)](LICENSE)

基于鹊桥协议的 QQ 与 Minecraft 服务器双向消息同步插件

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| 🔄 **双向消息同步** | QQ群消息 ↔ Minecraft服务器聊天实时同步 |
| 🎮 **玩家事件通知** | 玩家加入、离开、死亡、成就等事件自动转发 |
| ⚙️ **智能消息过滤** | 支持前缀过滤，灵活配置转发规则 |
| 🔧 **服务器管理** | RCON命令执行、服务器重启、玩家列表查询 |
| 🔌 **稳定可靠** | 自动重连机制，断线自动恢复 |
| 🐛 **调试支持** | 详细的调试日志，便于问题排查 |

## 📦 安装

### 通过 npm 安装
```bash
npm install koishi-plugin-mc-sync-bridge
```

### 通过 yarn 安装
```bash
yarn add koishi-plugin-mc-sync-bridge
```

## ⚙️ 配置指南

### 基础配置示例
```yaml
plugins:
  mc-sync-bridge:
    # 必填配置
    id: "gtl"                    # 服务器唯一标识
    name: "GTL服务器"            # 显示名称
    wsUrl: "ws://127.0.0.1:9999" # 鹊桥WebSocket地址
    selfName: "QQ机器人"         # X-Self-Name请求头
    
    # 可选配置
    wsToken: "your-token"        # 认证令牌（可选）
    groups: ["QQ群"]        # 绑定的QQ群号
    admins: ["123456789"]        # 管理员QQ号
    reconnectInterval: 30000     # 重连间隔(ms)
    debug: false                 # 调试模式
    
    # 过滤器配置
    filters:
      qqToMc:
        enable: true
        prefixes: ["#"]          # 仅转发以#开头的消息
      mcToQq:
        enable: true
        chat: true               # 转发玩家聊天
        join: true               # 转发玩家加入
        leave: true              # 转发玩家离开
        death: true              # 转发玩家死亡
        achievement: true        # 转发成就获得
        prefixes: []             # 聊天消息前缀过滤
```

### 配置字段说明

#### 🔧 必填字段
| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | string | 服务器唯一标识 | `"gtl"` |
| `name` | string | 服务器显示名称 | `"GTL服务器"` |
| `wsUrl` | string | 鹊桥WebSocket地址 | `"ws://127.0.0.1:9999"` |
| `selfName` | string | X-Self-Name请求头 | `"QQ机器人"` |

#### ⚙️ 可选字段
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `wsToken` | string | `""` | 认证令牌(Bearer) |
| `groups` | string[] | `[]` | 绑定的QQ群号|
| `admins` | string[] | `[]` | 管理员QQ号，支持同上格式 |
| `reconnectInterval` | number | `30000` | 重连间隔(毫秒) |
| `debug` | boolean | `false` | 启用调试日志 |

#### 🎯 过滤器配置
**QQ → MC 过滤器** (`filters.qqToMc`)
```yaml
qqToMc:
  enable: true                    # 是否启用
  prefixes: ["#", "!!"]          # 消息前缀过滤，空数组表示全部转发
```

**MC → QQ 过滤器** (`filters.mcToQq`)
```yaml
mcToQq:
  enable: true                    # 是否启用
  chat: true                     # 转发玩家聊天消息
  join: true                     # 转发玩家加入事件
  leave: true                    # 转发玩家离开事件
  death: true                    # 转发玩家死亡事件
  achievement: true              # 转发成就获得事件
  prefixes: []                   # 聊天消息前缀过滤（仅对聊天生效）
```

## 🎮 使用命令

### 基础命令格式
所有命令以 `.mc` 开头，需要在绑定的QQ群中使用。

### 📋 可用命令列表

| 命令 | 权限 | 描述 | 示例 |
|------|------|------|------|
| `.mc rcon <命令>` | 管理员 | 执行RCON命令 | `.mc rcon say Hello` |
| `.mc restart` | 管理员 | 重启Minecraft服务器 | `.mc restart` |
| `.mc list` | 所有人 | 查看在线玩家列表 | `.mc list` |

### 详细使用说明

#### 1. RCON命令执行
```bash
# 基本语法
.mc rcon <minecraft命令>

# 示例
.mc rcon say 大家好！
.mc rcon time set day
.mc rcon gamemode creative Notch
.mc rcon give @a diamond 64
```

#### 2. 服务器重启
```bash
# 重启服务器（需要管理员权限）
.mc restart

# 强制重启（发送SIGKILL信号）
.mc restart -k
```

#### 3. 玩家列表查询
```bash
# 查看当前在线玩家
.mc list
```

## 🔄 消息转发机制

### QQ → Minecraft 转发
- **触发条件**：QQ群消息匹配前缀过滤规则
- **处理流程**：
  1. 检查消息是否来自绑定的QQ群
  2. 验证消息前缀（如 `#`）
  3. 去除前缀后转发到Minecraft服务器
  4. 在游戏内显示为：`[QQ昵称] 消息内容`

### Minecraft → QQ 转发
- **支持的事件类型**：
  - 💬 **玩家聊天**：实时转发到QQ群
  - 🎉 **玩家加入**：`玩家名 加入了游戏`
  - 👋 **玩家离开**：`玩家名 离开了游戏`
  - 💀 **玩家死亡**：转发死亡消息
  - 🏆 **成就获得**：转发成就消息

## 🛠️ 故障排除

### 常见问题

#### 1. 连接失败
- ✅ 检查 `wsUrl` 配置是否正确
- ✅ 确认鹊桥服务正在运行
- ✅ 验证 `wsToken` 和 `selfName` 配置

#### 2. 消息未转发
- ✅ 确认QQ群号已正确配置
- ✅ 检查过滤器前缀设置
- ✅ 验证管理员权限配置

#### 3. 命令执行失败
- ✅ 确认用户有管理员权限
- ✅ 检查RCON服务是否启用
- ✅ 验证命令语法是否正确

### 调试模式
启用调试模式查看详细日志：
```yaml
debug: true
```

## 📚 开发相关

### 项目结构
```
src/
├── index.ts              # 插件入口和配置
├── connection.ts         # WebSocket连接管理
├── handlers/
│   └── mcToQq.ts        # MC→QQ消息处理器
├── commands/
│   ├── rcon.ts          # RCON命令
│   ├── restart.ts       # 重启命令
│   └── list.ts          # 玩家列表命令
└── utils/
    ├── helpers.ts       # 工具函数
    └── ai-client.ts     # AI客户端（可选）
```

### 构建项目
```bash
# 安装依赖
npm install

# 构建TypeScript
npm run build

# 开发模式（监听文件变化）
npm run dev
```

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个插件！

### 报告问题
- 请提供详细的错误日志
- 描述复现步骤
- 附上相关配置信息

### 功能建议
- 描述需求场景
- 说明预期行为
- 提供参考实现（如有）

---

**温馨提示**：使用本插件前，请确保已获得相关服务器的管理权限，并遵守服务器使用规则。
