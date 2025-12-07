import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取页面属性（包装 retrievePageProperty）。
 */
export async function retrievePageProperty(pageId: string, propertyId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.retrievePageProperty(pageId, propertyId); // 调用底层。
}

