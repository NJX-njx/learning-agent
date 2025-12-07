import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取单个块信息（包装 retrieveBlock）。
 */
export async function retrieveBlock(blockId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.retrieveBlock(blockId); // 调用底层。
}

