import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取块的子节点（包装 getBlockChildren）。
 */
export async function getBlockChildren(blockId: string, pageSize?: number, startCursor?: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.getBlockChildren(blockId, pageSize, startCursor); // 调用底层方法。
}

