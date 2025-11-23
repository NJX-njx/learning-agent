import path from "path"; // 引入 path 处理配置文件路径。
import { promises as fs } from "fs"; // 引入 fs 读取配置文件。
import { parse } from "comment-json"; // 使用 comment-json 解析 JSONC。

// MCP 配置文件的默认路径，允许通过环境变量覆盖。
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "mcp-config.jsonc"); // 组合默认路径。

// HTTP 类型 MCP 服务器配置。
export interface McpHttpServerConfig { // 定义 HTTP 服务器配置接口。
  url: string; // MCP 服务器 URL。
}

// 通过命令行启动的 stdio MCP 服务器配置。
export interface McpCommandServerConfig { // 定义命令行服务器配置接口。
  command: string; // 可执行文件。
  args?: Array<string>; // 可选参数列表。
  env?: Record<string, string>; // 额外环境变量。
  workingDirectory?: string; // 运行目录。
  timeoutSeconds?: number; // 可选超时时间（当前未使用，预留）。
}

// 联合类型：HTTP 或命令式配置。
export type McpServerConfig = McpHttpServerConfig | McpCommandServerConfig; // 联合类型定义。

// 内部缓存避免重复读取配置文件。
let cachedConfig: Record<string, McpServerConfig> | null = null; // 缓存对象。

/**
 * 加载 mcp-config.jsonc，并返回指定服务器的配置。
 * @param serverName mcpServers 中的 key。
 */
export async function getMcpServerConfig(serverName: string): Promise<McpServerConfig> { // 导出获取配置函数。
  if (!cachedConfig) { // 若缓存为空则加载。
    const configPath = process.env.MCP_CONFIG_PATH || DEFAULT_CONFIG_PATH; // 支持自定义路径。
    const fileContent = await fs.readFile(configPath, "utf-8"); // 读取文件。
    const parsed = parse(fileContent) as { mcpServers?: Record<string, unknown> }; // 解析 JSONC。
    if (!parsed.mcpServers) { // 验证结构。
      throw new Error(`配置文件 ${configPath} 缺少 mcpServers 字段`); // 抛错。
    }
    cachedConfig = {}; // 初始化缓存。
    for (const [name, value] of Object.entries(parsed.mcpServers)) { // 遍历服务器配置。
      if (value && typeof value === "object" && "url" in value && typeof (value as { url?: unknown }).url === "string") { // HTTP 类型。
        cachedConfig[name] = { url: (value as { url: string }).url }; // 缓存 HTTP 配置。
        continue; // 继续下一项。
      }
      if (value && typeof value === "object" && "command" in value && typeof (value as { command?: unknown }).command === "string") { // 命令类型。
        const commandValue = value as McpCommandServerConfig; // 断言类型。
        
        // 处理环境变量替换
        const env = commandValue.env ? { ...commandValue.env } : {};
        for (const [envKey, envVal] of Object.entries(env)) {
          if (typeof envVal === "string" && envVal.startsWith("${") && envVal.endsWith("}")) {
            const varName = envVal.slice(2, -1);
            env[envKey] = process.env[varName] || "";
            if (!env[envKey]) {
              console.warn(`Warning: Environment variable ${varName} referenced in config but not set.`);
            }
          }
        }

        cachedConfig[name] = { // 写入缓存。
          command: commandValue.command,
          args: commandValue.args,
          env: env,
          workingDirectory: commandValue.workingDirectory,
          timeoutSeconds: commandValue.timeoutSeconds
        };
        continue; // 继续下一项。
      }
      // 若无法识别则忽略，但记录日志便于排查。
      console.warn(`debugging: 未识别的 MCP 配置 ${name}`); // 输出警告。
    }
  }
  const serverConfig = cachedConfig[serverName]; // 读取缓存项。
  if (!serverConfig) { // 若不存在则抛错。
    throw new Error(`未在 MCP 配置中找到服务器：${serverName}`); // 抛错信息。
  }
  return serverConfig; // 返回配置。
}

