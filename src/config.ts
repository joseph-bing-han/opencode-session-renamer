import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface SessionRenamerConfig {
  // 用于生成标题的 LLM 模型，格式： "providerID/modelID"；留空表示使用服务端默认模型
  // 例如： "anthropic/claude-3-5-haiku-latest"
  model: string;

  // 生成标题的最大长度（不含日期后缀）
  titleMaxLength: number;

  // 标题中的日期格式（当前实现仅支持：YYYY/YY/MM/DD/HH/mm）
  // 例如： "YY-MM-DD HH:mm" -> "26-01-14 11:30"
  dateFormat: string;

  // 触发重命名的最小消息长度（避免非常短的消息触发）
  minMessageLength: number;

  // 是否开启调试日志
  debug: boolean;
}

export const DEFAULT_CONFIG: SessionRenamerConfig = {
  model: "opencode/grok-code",
  titleMaxLength: 20,
  dateFormat: "YY-MM-DD HH:mm",
  minMessageLength: 5,
  debug: false,
};

function parseJsonc(content: string): unknown {
  const stripped = content
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

export function loadConfig(directory: string): SessionRenamerConfig {
  const configPaths = [
    join(directory, ".opencode", "session-renamer.jsonc"),
    join(directory, ".opencode", "session-renamer.json"),
    join(process.env.HOME || "~", ".config", "opencode", "session-renamer.jsonc"),
    join(process.env.HOME || "~", ".config", "opencode", "session-renamer.json"),
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        const userConfig = parseJsonc(content) as Partial<SessionRenamerConfig>;
        return { ...DEFAULT_CONFIG, ...userConfig };
      } catch (error) {
        console.error(`[session-renamer] Failed to parse config at ${configPath}:`, error);
      }
    }
  }

  return DEFAULT_CONFIG;
}
