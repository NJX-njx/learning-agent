import { PaddleOcrMcpClient } from "../../clients/paddleocr-client"; // 引入 OCR 客户端。

let cachedClient: PaddleOcrMcpClient | null = null; // 缓存单例。

function getClient(): PaddleOcrMcpClient { // 获取客户端。
  if (cachedClient) return cachedClient; // 使用缓存。
  cachedClient = new PaddleOcrMcpClient(); // 创建实例。
  return cachedClient; // 返回实例。
}

/**
 * 运行 PaddleOCR-VL（多模态 OCR）。
 */
export async function runOcrVl(inputPath: string): Promise<any> { // 导出函数。
  const client = getClient(); // 获取客户端。
  return client.runOcrVL(inputPath); // 调用底层。
}

