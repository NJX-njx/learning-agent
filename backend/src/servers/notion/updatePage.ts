import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 更新页面属性（包装 notion-update-page）。
 */
export async function updatePage(pageId: string, properties: Record<string, string | number>): Promise<void> { // 导出 updatePage。
  const client = getNotionClient(); // 获取客户端。
  await client.updatePage(pageId, properties); // 调用底层更新。
}

