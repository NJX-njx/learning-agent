import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 删除（归档）块（包装 deleteBlock）。
 */
export async function deleteBlock(blockId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.deleteBlock(blockId); // 调用底层。
}

