import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 更新块内容（包装 updateBlock）。
 */
export async function updateBlock(blockId: string, block: any): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.updateBlock(blockId, block); // 调用底层。
}

