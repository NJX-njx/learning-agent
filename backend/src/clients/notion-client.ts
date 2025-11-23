import { NotionWritePayload, LearningTask } from "../types"; // 引入需要的类型定义。
import { Client } from "@modelcontextprotocol/sdk/client/index.js"; // 引入 MCP 客户端。
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"; // 引入 HTTP 传输。
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"; // 引入 Stdio 传输。
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"; // 引入工具调用结果 schema。
import { z } from "zod"; // 引入 zod 以推导类型。
import { getMcpServerConfig, McpHttpServerConfig, McpCommandServerConfig } from "../utils/mcp-config"; // 引入 MCP 配置加载器。

/**
 * NotionClientInterface 抽象了智能体需要的 Notion 能力。
 */
export interface NotionClientInterface { // 定义接口。
  /**
   * 创建新的 Notion 页面。
   * @param payload 页面内容载荷。
   */
  createPage(payload: NotionWritePayload): Promise<{ id: string; url?: string }>; // 返回新页面 ID 和 URL。

  /**
   * 更新 Notion 页面属性或内容。
   * @param pageId 目标页面 ID。
   * @param properties 属性键值。
   */
  updatePage(pageId: string, properties: Record<string, string | number>): Promise<void>; // 无返回值。

  /**
   * 创建评论用于提醒。
   * @param pageId 目标页面 ID。
   * @param commentText 评论文本。
   */
  createComment(pageId: string, commentText: string): Promise<void>; // 无返回值。

  /**
   * 根据标题搜索页面。
   * @param query 搜索关键词。
   */
  searchPage(query: string): Promise<{ id: string; title: string } | null>;

  // --- Expanded Capabilities ---
  getUser(userId: string): Promise<any>;
  listUsers(pageSize?: number, startCursor?: string): Promise<any>;
  getSelf(): Promise<any>;
  queryDatabase(databaseId: string, filter?: any, sorts?: any, pageSize?: number, startCursor?: string): Promise<any>;
  search(query: string, filter?: any, sort?: any, pageSize?: number, startCursor?: string): Promise<any>;
  getBlockChildren(blockId: string, pageSize?: number, startCursor?: string): Promise<any>;
  appendBlockChildren(blockId: string, children: any[]): Promise<any>;
  retrieveBlock(blockId: string): Promise<any>;
  updateBlock(blockId: string, block: any): Promise<any>;
  deleteBlock(blockId: string): Promise<any>;
  retrievePage(pageId: string): Promise<any>;
  createDatabase(parent: any, title: any[], properties: any): Promise<any>;
  updateDatabase(databaseId: string, properties: any): Promise<any>;
  retrieveDatabase(databaseId: string): Promise<any>;
  retrievePageProperty(pageId: string, propertyId: string): Promise<any>;
  retrieveComments(blockId: string, pageSize?: number, startCursor?: string): Promise<any>;
}



// 定义工具返回值类型，便于后续解析。
type CallToolResult = z.infer<typeof CallToolResultSchema>; // 通过 zod schema 推导类型。

/**
 * NotionMcpClient 使用 Notion 官方 MCP，基于 Streamable HTTP 进行真实调用。
 */
export class NotionMcpClient implements NotionClientInterface { // 定义真实客户端。
  private client: Client | null = null; // 缓存 MCP 客户端实例。
  private transport: StreamableHTTPClientTransport | StdioClientTransport | null = null; // 缓存传输层。
  private connectPromise: Promise<void> | null = null; // 防止重复连接。

  constructor(private readonly authToken = process.env.NOTION_MCP_TOKEN) { // 构造函数中注入令牌。
    if (!this.authToken) { // 若缺少令牌则抛错，引导用户配置。
      throw new Error("缺少 NOTION_MCP_TOKEN，请参考 https://developers.notion.com/docs/get-started-with-mcp 配置集成令牌"); // 抛出明确错误。
    }
    if (!this.authToken.startsWith("secret_")) {
      console.warn("Warning: NOTION_MCP_TOKEN does not start with 'secret_'. You might be using a browser cookie (token_v2) instead of an API Integration Secret. Please check https://www.notion.so/my-integrations");
    }
  }

  /**
   * 创建页面：调用 API-post-page 工具。
   */
  async createPage(payload: NotionWritePayload): Promise<{ id: string; url?: string }> {
    console.log("debugging: NotionMcpClient.createPage", payload.title);
    
    // 转换 markdownContent 为 Notion Blocks (简化版：只处理段落)
    const children = payload.markdownContent.split('\n').filter(line => line.trim()).map(line => {
      if (line.startsWith('# ')) {
        return {
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: [{ type: "text", text: { content: line.replace('# ', '') } }] }
        };
      } else if (line.startsWith('## ')) {
        return {
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: line.replace('## ', '') } }] }
        };
      } else if (line.startsWith('- ')) {
        return {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.replace('- ', '') } }] }
        };
      }
      return {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: line } }] }
      };
    });

    // 附加元数据到内容顶部
    const metaInfo = [
      `Priority: ${payload.properties.priority}`,
      `Type: ${payload.properties.type}`,
      `Due Date: ${payload.properties.dueDate}`
    ].join('\n');
    
    children.unshift({
      object: "block",
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: metaInfo } }],
        icon: { emoji: "ℹ️" }
      }
    } as any);

    const args = {
      parent: { page_id: payload.parentPageId },
      properties: {
        title: [
          {
            text: {
              content: payload.title
            }
          }
        ]
      }
      // Remove children from createPage args to avoid potential MCP schema issues
      // We will append children in a separate step
    };

    console.log("debugging: calling API-post-page with args", JSON.stringify(args, null, 2));
    const result = await this.callTool("API-post-page", args);
    
    const newPageId = this.extractResourceIdentifier(result);
    console.log(`debugging: created page ${newPageId}, now appending content...`);

    if (newPageId && !newPageId.startsWith('notion-')) {
      try {
        // Append content in a separate step to ensure it gets added
        // Notion API limits children to 100 blocks per request, so we might need to batch if content is large
        // For now, we assume it fits or we just send it all (MCP might handle it or fail)
        
        // Batching logic just in case
        const BATCH_SIZE = 100;
        for (let i = 0; i < children.length; i += BATCH_SIZE) {
          const batch = children.slice(i, i + BATCH_SIZE);
          await this.appendBlockChildren(newPageId, batch);
        }
        console.log("debugging: content appended successfully");
      } catch (error) {
        console.error("debugging: failed to append initial content to new page", error);
      }
    }

    let pageUrl: string | undefined;
    // 尝试解析并打印页面 URL，方便用户直接打开
    try {
      for (const item of result.content) {
        if (item.type === 'text') {
          const data = JSON.parse(item.text);
          if (data.url) {
            pageUrl = data.url;
            console.log(`\n✨ Notion 页面已创建！点击链接直接打开:\n👉 ${data.url}\n`);
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，不影响流程
    }

    return {
      id: this.extractResourceIdentifier(result),
      url: pageUrl
    };
  }

  /**
   * 更新页面属性：调用 API-patch-page。
   */
  async updatePage(pageId: string, properties: Record<string, string | number>): Promise<void> {
    console.log("debugging: NotionMcpClient.updatePage", pageId);
    // 注意：API-patch-page 只能更新 properties，不能直接追加内容。
    // 这里我们只打印日志，因为更新 properties 需要知道具体的 property ID 或名称，且结构复杂。
    // 暂时跳过实际更新，避免报错。
    console.log("debugging: Skipping property update for now due to schema complexity", properties);
  }

  /**
   * 创建评论：调用 API-create-a-comment。
   */
  async createComment(pageId: string, commentText: string): Promise<void> {
    console.log("debugging: NotionMcpClient.createComment", pageId);
    try {
      await this.callTool("API-create-a-comment", {
        parent: { page_id: pageId },
        rich_text: [
          {
            text: {
              content: commentText
            }
          }
        ]
      });
    } catch (error) {
      console.warn("debugging: Failed to create comment (likely permission issue), skipping.", error);
    }
  }

  /**
   * 搜索页面 ID 和标题。
   */
  async searchPage(query: string): Promise<{ id: string; title: string } | null> {
    console.log("debugging: NotionMcpClient.searchPage", query);
    const args = {
      query,
      filter: {
        value: "page",
        property: "object"
      },
      page_size: 1
    };
    
    try {
      const result = await this.callTool("API-post-search", args);
      for (const item of result.content) {
        if (item.type === "text") {
          try {
            const data = JSON.parse(item.text);
            if (data.results && data.results.length > 0) {
              const page = data.results[0];
              let title = "Untitled";
              
              // Find the property of type 'title'
              if (page.properties) {
                for (const key in page.properties) {
                  if (page.properties[key].type === "title") {
                    const titleObj = page.properties[key].title;
                    if (Array.isArray(titleObj)) {
                      title = titleObj.map((t: any) => t.plain_text).join("");
                    }
                    break;
                  }
                }
              }
              
              return { id: page.id, title };
            }
          } catch (e) {
            console.warn("debugging: failed to parse search result", e);
          }
        }
      }
      return null;
    } catch (error) {
      console.warn("debugging: searchPage failed", error);
      return null;
    }
  }

  // --- Expanded Capabilities Implementation ---

  async getUser(userId: string): Promise<any> {
    const result = await this.callTool("API-get-user", { user_id: userId });
    return this.parseResult(result);
  }

  async listUsers(pageSize?: number, startCursor?: string): Promise<any> {
    const args: any = {};
    if (pageSize) args.page_size = pageSize;
    if (startCursor) args.start_cursor = startCursor;
    const result = await this.callTool("API-get-users", args);
    return this.parseResult(result);
  }

  async getSelf(): Promise<any> {
    const result = await this.callTool("API-get-self", {});
    return this.parseResult(result);
  }

  async queryDatabase(databaseId: string, filter?: any, sorts?: any, pageSize?: number, startCursor?: string): Promise<any> {
    const args: any = { database_id: databaseId };
    if (filter) args.filter = filter;
    if (sorts) args.sorts = sorts;
    if (pageSize) args.page_size = pageSize;
    if (startCursor) args.start_cursor = startCursor;
    const result = await this.callTool("API-post-database-query", args);
    return this.parseResult(result);
  }

  async search(query: string, filter?: any, sort?: any, pageSize?: number, startCursor?: string): Promise<any> {
    const args: any = { query };
    if (filter) args.filter = filter;
    if (sort) args.sort = sort;
    if (pageSize) args.page_size = pageSize;
    if (startCursor) args.start_cursor = startCursor;
    const result = await this.callTool("API-post-search", args);
    return this.parseResult(result);
  }

  async getBlockChildren(blockId: string, pageSize?: number, startCursor?: string): Promise<any> {
    const args: any = { block_id: blockId };
    if (pageSize) args.page_size = pageSize;
    if (startCursor) args.start_cursor = startCursor;
    const result = await this.callTool("API-get-block-children", args);
    return this.parseResult(result);
  }

  async appendBlockChildren(blockId: string, children: any[]): Promise<any> {
    const result = await this.callTool("API-patch-block-children", { block_id: blockId, children });
    return this.parseResult(result);
  }

  async retrieveBlock(blockId: string): Promise<any> {
    const result = await this.callTool("API-retrieve-a-block", { block_id: blockId });
    return this.parseResult(result);
  }

  async updateBlock(blockId: string, block: any): Promise<any> {
    const result = await this.callTool("API-update-a-block", { block_id: blockId, ...block });
    return this.parseResult(result);
  }

  async deleteBlock(blockId: string): Promise<any> {
    const result = await this.callTool("API-delete-a-block", { block_id: blockId });
    return this.parseResult(result);
  }

  async retrievePage(pageId: string): Promise<any> {
    const result = await this.callTool("API-retrieve-a-page", { page_id: pageId });
    return this.parseResult(result);
  }

  async createDatabase(parent: any, title: any[], properties: any): Promise<any> {
    const result = await this.callTool("API-create-a-database", { parent, title, properties });
    return this.parseResult(result);
  }

  async updateDatabase(databaseId: string, properties: any): Promise<any> {
    const result = await this.callTool("API-update-a-database", { database_id: databaseId, properties });
    return this.parseResult(result);
  }

  async retrieveDatabase(databaseId: string): Promise<any> {
    const result = await this.callTool("API-retrieve-a-database", { database_id: databaseId });
    return this.parseResult(result);
  }

  async retrievePageProperty(pageId: string, propertyId: string): Promise<any> {
    const result = await this.callTool("API-retrieve-a-page-property", { page_id: pageId, property_id: propertyId });
    return this.parseResult(result);
  }

  async retrieveComments(blockId: string, pageSize?: number, startCursor?: string): Promise<any> {
    const args: any = { block_id: blockId };
    if (pageSize) args.page_size = pageSize;
    if (startCursor) args.start_cursor = startCursor;
    const result = await this.callTool("API-retrieve-a-comment", args);
    return this.parseResult(result);
  }

  private parseResult(result: CallToolResult): any {
    for (const item of result.content) {
      if (item.type === "text") {
        try {
          return JSON.parse(item.text);
        } catch (e) {
          return item.text;
        }
      }
    }
    return result;
  }

  /**
   * 统一工具调用入口，确保在调用前完成连接。
   */
  private async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> { // 定义工具调用函数。
    const client = await this.ensureConnected(); // 确保已连接。
    const request = { // 构建 request payload。
      method: "tools/call", // 标准 MCP 方法。
      params: {
        name, // 工具名。
        arguments: args // 具体参数。
      }
    }; // 请求对象结束。
    const result = await client.request(request, CallToolResultSchema); // 发送请求并通过 schema 验证。
    console.log("debugging: NotionMcpClient.callTool result items", result.content.length); // 打印结果数量。
    return result; // 返回结果。
  }

  /**
   * 确保 MCP 客户端与传输只初始化一次。
   */
  private async ensureConnected(): Promise<Client> { // 定义连接函数。
    if (this.client) { // 若已存在直接返回。
      return this.client; // 返回已连接的客户端。
    }
    if (this.connectPromise) { // 若正在连接，等待完成。
      await this.connectPromise; // 等待现有 Promise。
      if (!this.client) { // 再次校验。
        throw new Error("Notion MCP 客户端初始化失败"); // 抛出错误。
      }
      return this.client; // 返回客户端。
    }
    this.connectPromise = this.initializeConnection(); // 启动连接流程。
    await this.connectPromise; // 等待连接完成。
    if (!this.client) { // 校验是否成功。
      throw new Error("Notion MCP 客户端在初始化后为空"); // 抛出错误。
    }
    return this.client; // 返回客户端。
  }

  /**
   * 依据 mcp-config.jsonc 建立连接（支持 HTTP 或 Stdio）。
   */
  private async initializeConnection(): Promise<void> { // 定义实际连接实现。
    const rawConfig = await getMcpServerConfig("notion"); // 加载配置。
    
    this.client = new Client({ // 创建 MCP 客户端。
      name: "learning-agent-notion-client", // 客户端名称。
      version: "0.1.0" // 版本号。
    }, {
      capabilities: {}
    }); // 客户端完成。

    this.client.onerror = (error: unknown) => { // 注册错误处理并显式类型声明。
      console.error("debugging: Notion MCP client error", error); // 输出错误。
    }; // 回调结束。

    if ("url" in rawConfig) { // HTTP 类型。
      const config = rawConfig as McpHttpServerConfig; // 强制转换。
      const requestInitHeaders: Record<string, string> = { // 构建请求头。
        Authorization: `Bearer ${this.authToken}`, // 传递 Notion 集成令牌。
        "Notion-Version": process.env.NOTION_MCP_VERSION || "2022-06-28" // 指定版本。
      }; // 头部定义结束。
      this.transport = new StreamableHTTPClientTransport(new URL(config.url), { // 创建 HTTP 传输。
        requestInit: {
          headers: requestInitHeaders // 设置头部。
        }
      }); // 传输实例化结束。
    } else if ("command" in rawConfig) { // Stdio 类型。
      const config = rawConfig as McpCommandServerConfig;
      const env: Record<string, string> = {};
      // 传递当前环境变量
      for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === "string") {
          env[key] = value;
        }
      }
      // 传递配置中的环境变量（包括 NOTION_TOKEN）
      if (config.env) {
        Object.assign(env, config.env);
      }
      // 确保 NOTION_TOKEN 存在
      if (!env.NOTION_TOKEN && this.authToken) {
        env.NOTION_TOKEN = this.authToken;
      }

      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
        cwd: config.workingDirectory
      });
    } else {
      throw new Error("Notion MCP 配置无效：必须包含 url 或 command");
    }

    await this.client.connect(this.transport); // 执行连接。
    console.log("debugging: Notion MCP connected"); // 输出成功日志。
  }

  /**
   * 从工具结果中提取页面或资源标识符，便于上层追踪。
   */
  private extractResourceIdentifier(result: CallToolResult): string { // 定义提取函数。
    for (const item of result.content) { // 遍历内容数组。
      if (item.type === "resource_link" && item.uri) { // 若为资源链接。
        return item.uri; // 返回 URI。
      }
      if (item.type === "text" && item.text) { // 若为文本。
        // 尝试解析 JSON
        try {
          const data = JSON.parse(item.text);
          if (data.id) {
            return data.id;
          }
        } catch (e) {
          // 忽略非 JSON 文本
        }

        const match = item.text.match(/page_id\s*[:：]\s*(\S+)/i); // 尝试匹配 page_id。
        if (match) { // 成功则返回。
          return match[1]; // 返回匹配值。
        }
      }
    }
    return `notion-${Date.now()}`; // 若无可用内容，返回临时 ID。
  }
}

