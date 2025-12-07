import { PaddleOcrMcpClient } from "../../clients/paddleocr-client"; // 引入 OCR 客户端实现。

let cachedClient: PaddleOcrMcpClient | null = null; // 缓存 OCR 客户端单例。

/**
 * 获取或创建 OCR 客户端。
 */
function getOcrClient(): PaddleOcrMcpClient { // 定义获取客户端函数。
  if (cachedClient) { // 如果已有缓存。
    return cachedClient; // 返回缓存实例。
  } // 条件结束。
  console.log("debugging: create PaddleOcrMcpClient singleton"); // 打印调试日志。
  cachedClient = new PaddleOcrMcpClient(); // 创建新实例。
  return cachedClient; // 返回实例。
}

/**
 * 运行结构化 OCR，返回标准化结果。
 * @param imagePath 图片绝对路径。
 */
export async function runStructuredOcr(imagePath: string) { // 导出 OCR 运行函数。
  console.log(`debugging: runStructuredOcr path=${imagePath}`); // 记录输入路径。
  const client = getOcrClient(); // 获取 OCR 客户端。
  const result = await client.runStructuredOcr(imagePath); // 执行 OCR。
  console.log("debugging: runStructuredOcr finished"); // 记录结束。
  return result; // 返回结果。
}

