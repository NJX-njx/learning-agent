import { NotionMcpClient, NotionClientInterface } from "../../clients/notion-client"; // 引入 Notion 客户端类型与实现。

let cachedClient: NotionClientInterface | null = null; // 缓存单例客户端，避免重复连接。

/**
 * 获取 Notion 客户端单例。
 */
export function getNotionClient(): NotionClientInterface { // 导出获取客户端的函数。
  if (cachedClient) { // 如果已有实例。
    return cachedClient; // 直接返回缓存实例。
  } // 条件结束。
  console.log("debugging: create NotionMcpClient singleton"); // 打印调试日志。
  cachedClient = new NotionMcpClient(); // 创建新的 MCP 客户端。
  return cachedClient; // 返回创建的实例。
}

