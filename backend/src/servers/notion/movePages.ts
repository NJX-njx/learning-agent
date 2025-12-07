import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 移动页面到新的父级（包装 notion-move-pages）。
 */
export async function movePages(pageIds: Array<string>, newParentId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.movePages(pageIds, newParentId); // 调用底层。
}

