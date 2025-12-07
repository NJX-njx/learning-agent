import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 创建数据库（包装 createDatabase）。
 */
export async function createDatabase(parentPageId: string, title: string, properties: any): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  const parent = { page_id: parentPageId }; // 构造父级。
  const titleObj = [{ type: "text", text: { content: title } }]; // 标题对象。
  return client.createDatabase(parent, titleObj, properties); // 调用底层。
}

