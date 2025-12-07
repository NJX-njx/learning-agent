import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 复制页面（包装 notion-duplicate-page）。
 */
export async function duplicatePage(pageId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.duplicatePage(pageId); // 调用底层。
}

