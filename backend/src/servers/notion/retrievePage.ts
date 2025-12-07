import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取页面信息（包装 retrievePage）。
 */
export async function retrievePage(pageId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.retrievePage(pageId); // 调用底层。
}

