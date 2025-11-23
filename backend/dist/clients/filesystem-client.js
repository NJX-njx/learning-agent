"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesystemMcpClient = exports.LocalFilesystemClient = void 0;
const fs_1 = require("fs"); // 引入文件系统 Promise API 以便异步读写文件。
const path_1 = __importDefault(require("path")); // 引入 path 用于归一化路径。
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js"); // 引入 MCP 客户端。
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js"); // 引入 stdio 传输层。
const types_js_1 = require("@modelcontextprotocol/sdk/types.js"); // 引入工具结果 schema。
const mcp_config_1 = require("../utils/mcp-config"); // 引入 MCP 配置读取器。
/**
 * LocalFilesystemClient 使用 Node.js fs/promises 实现 FilesystemClientInterface。
 */
class LocalFilesystemClient {
    /**
     * 通过 fs.promises 读取文件，并在关键步骤输出调试日志。
     */
    async readBinary(absolutePath) {
        console.log("debugging: starting file read", absolutePath); // 输出调试信息以便定位问题。
        const fileBuffer = await fs_1.promises.readFile(absolutePath); // 实际读取文件并获取 Buffer。
        console.log("debugging: completed file read", fileBuffer.byteLength); // 输出读取结果的字节长度。
        return fileBuffer; // 返回读取到的 Buffer。
    }
}
exports.LocalFilesystemClient = LocalFilesystemClient;
/**
 * FilesystemMcpClient 使用 @modelcontextprotocol/server-filesystem 提供的工具读取文件。
 */
class FilesystemMcpClient {
    constructor() {
        this.client = null; // 缓存 MCP 客户端。
        this.transport = null; // 缓存传输实例。
        this.connectPromise = null; // 防止重复连接。
    }
    /**
     * 通过 MCP 的 read_text_file 工具读取文件，并返回 Buffer。
     */
    async readBinary(absolutePath) {
        const normalizedPath = path_1.default.resolve(absolutePath); // 归一化路径防止逃逸。
        console.log("debugging: FilesystemMcpClient.readBinary", normalizedPath); // 输出调试信息。
        const result = await this.callTool("read_text_file", { path: normalizedPath }); // 调用读取工具。
        const firstItem = result.content[0]; // 仅关注首个内容。
        if (firstItem && firstItem.type === "text") { // 处理文本内容。
            return Buffer.from(firstItem.text, "utf-8"); // 将文本转为 Buffer。
        }
        if (firstItem && "data" in firstItem && typeof firstItem.data === "string") { // 处理媒体内容。
            return Buffer.from(firstItem.data, "base64"); // base64 转 Buffer。
        }
        throw new Error("filesystem MCP 返回了无法解析的内容，请确认工具输出"); // 若不匹配则抛错。
    }
    /**
     * 统一的工具调用封装。
     */
    async callTool(name, args) {
        const client = await this.ensureConnected(); // 确保已经连接。
        const request = {
            method: "tools/call", // 固定方法名。
            params: {
                name, // 工具名。
                arguments: args // 工具参数。
            }
        }; // 请求对象结束。
        return client.request(request, types_js_1.CallToolResultSchema); // 发送请求并返回结果。
    }
    /**
     * 初始化连接，仅在首次调用时触发。
     */
    async ensureConnected() {
        if (this.client) { // 已连接直接返回。
            return this.client; // 返回缓存实例。
        }
        if (this.connectPromise) { // 若正在连接，等待完成。
            await this.connectPromise; // 等待连接 Promise。
            if (!this.client) { // 再次校验。
                throw new Error("filesystem MCP 客户端初始化失败"); // 抛出异常。
            }
            return this.client; // 返回已就绪客户端。
        }
        this.connectPromise = this.initializeConnection(); // 触发初始化。
        await this.connectPromise; // 等待完成。
        if (!this.client) { // 校验连接结果。
            throw new Error("filesystem MCP 客户端在初始化后为空"); // 抛出异常。
        }
        return this.client; // 返回客户端。
    }
    /**
     * 根据 mcp-config.jsonc 启动 server-filesystem。
     */
    async initializeConnection() {
        const rawConfig = await (0, mcp_config_1.getMcpServerConfig)("filesystem"); // 读取配置。
        if (!("command" in rawConfig)) { // 校验类型。
            throw new Error("filesystem MCP 配置缺少 command 字段"); // 抛错。
        }
        const config = rawConfig; // 强制转换。
        const env = {}; // 构建环境变量。
        for (const [key, value] of Object.entries(process.env)) { // 遍历当前环境。
            if (typeof value === "string") { // 仅拷贝字符串。
                env[key] = value; // 复制变量。
            }
        }
        if (config.env) { // 合并额外 env。
            Object.assign(env, config.env); // 合并配置环境。
        }
        this.transport = new stdio_js_1.StdioClientTransport({
            command: config.command, // 指定命令。
            args: config.args, // 指定参数。
            env, // 传入合并后的环境。
            cwd: config.workingDirectory // 设置工作目录。
        }); // 传输配置完成。
        this.client = new index_js_1.Client({
            name: "learning-agent-filesystem-client", // 客户端名称。
            version: "0.1.0" // 版本。
        }); // 客户端实例。
        this.client.onerror = (error) => {
            console.error("debugging: filesystem MCP client error", error); // 输出错误。
        }; // 结束回调。
        await this.client.connect(this.transport); // 连接服务器。
        console.log("debugging: filesystem MCP connected"); // 输出成功日志。
        process.once("exit", () => {
            void this.dispose(); // 触发清理。
        }); // 监听结束。
    }
    /**
     * 关闭底层连接，避免僵尸进程。
     */
    async dispose() {
        if (this.client) { // 若客户端存在。
            await this.client.close(); // 关闭协议。
            this.client = null; // 清空引用。
        }
        if (this.transport) { // 若传输存在。
            await this.transport.close(); // 关闭传输。
            this.transport = null; // 清空引用。
        }
        this.connectPromise = null; // 重置连接状态。
    }
}
exports.FilesystemMcpClient = FilesystemMcpClient;
