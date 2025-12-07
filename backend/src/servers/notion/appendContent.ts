import { getNotionClient } from "./client"; // 引入 Notion 客户端单例。

/**
 * 追加 Markdown 内容到指定页面。
 * @param pageId 目标页面 ID。
 * @param content 要追加的 Markdown 文本。
 */
export async function appendContent(pageId: string, content: string): Promise<{ success: boolean }> { // 导出追加内容函数。
  console.log(`debugging: notion appendContent page=${pageId}`); // 打印调试日志。
  const client = getNotionClient(); // 获取客户端。
  const lines = content.split("\n").filter((line) => line.trim()); // 按行拆分并过滤空行。
  const children = lines.map((line) => { // 将 Markdown 行转换为 Notion 段落块。
    return { // 返回块定义。
      object: "block", // 块类型标识。
      type: "paragraph", // 使用段落类型。
      paragraph: { // 段落主体。
        rich_text: [ // 文本数组。
          { // 单个文本节点。
            type: "text", // 文本类型。
            text: { content: line } // 文本内容。
          } // 文本节点结束。
        ] // rich_text 结束。
      } // paragraph 结束。
    }; // 块定义结束。
  }); // map 结束。
  await client.appendBlockChildren(pageId, children); // 调用底层追加接口。
  console.log("debugging: notion appendContent success"); // 记录成功日志。
  return { success: true }; // 返回成功标记。
}

