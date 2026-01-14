# opencode-session-renamer

Chinese version: [简体中文](#简体中文)

Automatically generates a session title from the user's first message and renames the OpenCode session (with a timestamp suffix).

## Install

Add the plugin to your `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-session-renamer"]
}
```

Restart OpenCode after installation.

## Development Install

For development or contributing, you can install from source:

### Option 1: Symlink to Plugin Directory

```bash
# Clone the repo
git clone https://github.com/joseph-bing-han/opencode-session-renamer.git
cd opencode-session-renamer

# Install dependencies and build
bun install
bun run build

# Create symlink
ln -sf $(pwd)/src/index.ts ~/.config/opencode/plugin/session-renamer.ts
```

### Option 2: Configure Local Path

Add the local path to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": [
    "/path/to/opencode-session-renamer/dist/index.js"
  ]
}
```

## Configuration

The plugin loads config files in this order (first match wins):

1. `<project>/.opencode/session-renamer.jsonc`
2. `<project>/.opencode/session-renamer.json`
3. `~/.config/opencode/session-renamer.jsonc`
4. `~/.config/opencode/session-renamer.json`

Example:

```jsonc
{
  "model": "opencode/grok-code",
  "titleMaxLength": 20,
  "dateFormat": "YY-MM-DD HH:mm",
  "minMessageLength": 5,
  "debug": false
}
```

Fields:

- `model`: Model used for title generation in `providerID/modelID` format. Default: `opencode/grok-code`.
- `titleMaxLength`: Maximum title length (excluding the timestamp suffix).
- `dateFormat`: Date format (currently supports: `YYYY` / `YY` / `MM` / `DD` / `HH` / `mm`).
- `minMessageLength`: Minimum message length to trigger rename (to avoid renaming on very short messages).
- `debug`: Enable debug logs (prefixed with `[session-renamer]`).

## FAQ

### 1) Why do I get `ProviderModelNotFoundError`?

This usually means `model` is set to a model ID that doesn't exist in your current OpenCode provider list. Change it to a valid model (e.g. `opencode/grok-code` or `opencode/glm-4.7-free`).

The plugin also tries to fetch available models from OpenCode `/config/providers` and fall back automatically, but the most reliable approach is still to set `model` to an ID that is available in your environment.

---

## 简体中文

自动根据用户第一条消息内容，为 OpenCode 的会话生成标题并重命名（附带时间后缀）。

### 安装

在 `~/.config/opencode/opencode.jsonc` 中添加插件：

```jsonc
{
  "plugin": ["opencode-session-renamer"]
}
```

安装后需要重启 OpenCode。

### 开发安装

如需开发或贡献代码，可以从源码安装：

#### 方式一：符号链接到插件目录

```bash
# 克隆仓库
git clone https://github.com/joseph-bing-han/opencode-session-renamer.git
cd opencode-session-renamer

# 安装依赖并构建
bun install
bun run build

# 创建符号链接
ln -sf $(pwd)/src/index.ts ~/.config/opencode/plugin/session-renamer.ts
```

#### 方式二：配置本地路径

在 `~/.config/opencode/opencode.jsonc` 中添加本地路径：

```jsonc
{
  "plugin": [
    "/path/to/opencode-session-renamer/dist/index.js"
  ]
}
```

### 配置

插件会按以下顺序加载配置文件（先找到的优先）：

1. `<project>/.opencode/session-renamer.jsonc`
2. `<project>/.opencode/session-renamer.json`
3. `~/.config/opencode/session-renamer.jsonc`
4. `~/.config/opencode/session-renamer.json`

示例：

```jsonc
{
  "model": "opencode/grok-code",
  "titleMaxLength": 20,
  "dateFormat": "YY-MM-DD HH:mm",
  "minMessageLength": 5,
  "debug": false
}
```

字段说明：

- `model`: 生成标题使用的模型，格式为 `providerID/modelID`。默认 `opencode/grok-code`。
- `titleMaxLength`: 标题最大长度（不含日期后缀）。
- `dateFormat`: 日期格式（当前实现支持：`YYYY` / `YY` / `MM` / `DD` / `HH` / `mm`）。
- `minMessageLength`: 触发重命名的最小消息长度（避免过短消息触发）。
- `debug`: 开启后输出调试日志（前缀为 `[session-renamer]`）。

### 常见问题

#### 1) 为什么报 `ProviderModelNotFoundError`？

通常是 `model` 配置了不存在的模型 ID。请改成真实存在的模型（例如 `opencode/grok-code` 或 `opencode/glm-4.7-free`）。

插件内部也会尝试从 OpenCode 的 `/config/providers` 获取可用模型并自动回退，但最稳妥的方式仍是把 `model` 配置成你当前环境确实可用的 ID。
