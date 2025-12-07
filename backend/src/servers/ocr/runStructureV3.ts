import { PaddleOcrMcpClient } from "../../clients/paddleocr-client"; // 引入 OCR 客户端。

let cachedClient: PaddleOcrMcpClient | null = null; // 缓存单例。

function getClient(): PaddleOcrMcpClient { // 获取客户端实例。
  if (cachedClient) return cachedClient; // 返回缓存。
  cachedClient = new PaddleOcrMcpClient(); // 创建新实例。
  return cachedClient; // 返回实例。
}

/**
 * 运行 PP-StructureV3（版面结构化）。
 */
export async function runStructureV3(inputPath: string): Promise<any> { // 导出函数。
  const client = getClient(); // 获取客户端。
  return client.runStructureV3(inputPath); // 调用底层。
}

