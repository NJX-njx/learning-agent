"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMcpServerConfig = getMcpServerConfig;
const path_1 = __importDefault(require("path")); // 引入 path 处理配置文件路径。
const fs_1 = require("fs"); // 引入 fs 读取配置文件。
const comment_json_1 = require("comment-json"); // 使用 comment-json 解析 JSONC。
// MCP 配置文件的默认路径，允许通过环境变量覆盖。
const DEFAULT_CONFIG_PATH = path_1.default.join(process.cwd(), "mcp-config.jsonc"); // 组合默认路径。
// 内部缓存避免重复读取配置文件。
let cachedConfig = null; // 缓存对象。
/**
 * 加载 mcp-config.jsonc，并返回指定服务器的配置。
 * @param serverName mcpServers 中的 key。
 */
async function getMcpServerConfig(serverName) {
    if (!cachedConfig) { // 若缓存为空则加载。
        const configPath = process.env.MCP_CONFIG_PATH || DEFAULT_CONFIG_PATH; // 支持自定义路径。
        const fileContent = await fs_1.promises.readFile(configPath, "utf-8"); // 读取文件。
        const parsed = (0, comment_json_1.parse)(fileContent); // 解析 JSONC。
        if (!parsed.mcpServers) { // 验证结构。
            throw new Error(`配置文件 ${configPath} 缺少 mcpServers 字段`); // 抛错。
        }
        cachedConfig = {}; // 初始化缓存。
        for (const [name, value] of Object.entries(parsed.mcpServers)) { // 遍历服务器配置。
            if (value && typeof value === "object" && "url" in value && typeof value.url === "string") { // HTTP 类型。
                cachedConfig[name] = { url: value.url }; // 缓存 HTTP 配置。
                continue; // 继续下一项。
            }
            if (value && typeof value === "object" && "command" in value && typeof value.command === "string") { // 命令类型。
                const commandValue = value; // 断言类型。
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
                cachedConfig[name] = {
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
