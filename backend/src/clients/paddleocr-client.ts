import { OcrStructuredResult, OcrTextSpan } from "../types";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { getMcpServerConfig, McpCommandServerConfig } from "../utils/mcp-config";
import path from "path";

/**
 * PaddleOcrClientInterface 规定 OCR 客户端需要提供的核心行为。
 */
export interface PaddleOcrClientInterface { // 定义 OCR 客户端接口。
  /**
   * 执行结构化 OCR，输出多种格式文本。
   * @param imagePath 输入图片绝对路径。
   */
  runStructuredOcr(imagePath: string): Promise<OcrStructuredResult>; // 声明主方法。
}



/**
 * 使用真实的 PaddleOCR MCP（stdio 模式）执行 OCR。
 */
export class PaddleOcrMcpClient implements PaddleOcrClientInterface {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connectPromise: Promise<Client> | null = null;

  constructor(private readonly serverName: string = process.env.PADDLE_OCR_MCP_SERVER || "paddleocr") {
    console.log("debugging: PaddleOcrMcpClient using server", this.serverName);
  }

  async runStructuredOcr(imagePath: string): Promise<OcrStructuredResult> {
    const normalizedPath = path.resolve(imagePath);
    console.log("debugging: PaddleOcrMcpClient.runStructuredOcr", normalizedPath);
    const result = await this.callTool("ocr", {
      input_data: normalizedPath,
      output_mode: "detailed"
    });
    const rawPayload = this.parseDetailedResult(result);
    return this.toStructuredResult(rawPayload, normalizedPath);
  }

  private async callTool(name: string, args: Record<string, any>) {
    const client = await this.ensureConnected();
    const request = {
      method: "tools/call" as const,
      params: {
        name,
        arguments: args
      }
    };

    // 可通过环境变量调整单次请求超时（毫秒），默认 120s
    const baseTimeout = Number(process.env.PADDLE_OCR_REQUEST_TIMEOUT_MS) || 120000;
    const maxAttempts = Number(process.env.PADDLE_OCR_REQUEST_RETRIES) || 3;

    let lastError: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timeout = baseTimeout * attempt; // 逐次增长超时时间
      try {
        const result = await client.request(request, CallToolResultSchema, {
          timeout,
          // 限制最大累计等待时间为 baseTimeout * maxAttempts
          maxTotalTimeout: baseTimeout * maxAttempts,
          // 当收到 progress 消息时重置单次超时
          resetTimeoutOnProgress: true
        });

        if (result.isError) {
          const message = result.content
            .map((item: any) => (item.type === "text" ? item.text : ""))
            .filter(Boolean)
            .join("\n");
          throw new Error(`PaddleOCR MCP 调用失败: ${message || "未知错误"}`);
        }
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`PaddleOcrMcpClient.callTool attempt ${attempt} failed: ${(err as any)?.message || err}`);
        // 对于最后一次尝试，抛出错误；否则短暂等待后重试
        if (attempt === maxAttempts) {
          throw err;
        }
        // 等待一小段时间再重试（指数退避的一部分）
        const backoffMs = 1000 * attempt;
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    throw lastError;
  }

  private async ensureConnected(): Promise<Client> {
    if (this.client) {
      return this.client;
    }
    if (this.connectPromise) {
      await this.connectPromise;
      if (!this.client) {
        throw new Error("PaddleOCR MCP 客户端初始化失败");
      }
      return this.client;
    }
    this.connectPromise = this.initializeConnection();
    await this.connectPromise;
    if (!this.client) {
      throw new Error("PaddleOCR MCP 客户端在初始化后为空");
    }
    return this.client;
  }

  private async initializeConnection(): Promise<Client> {
    const rawConfig = await getMcpServerConfig(this.serverName);
    if (!("command" in rawConfig)) {
      throw new Error(`PaddleOCR MCP 配置 ${this.serverName} 不是 stdio 类型，请改用本地/stdio 配置`);
    }
    const config = rawConfig as McpCommandServerConfig;
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
    if (config.env) {
      Object.assign(env, config.env);
    }
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env,
      cwd: config.workingDirectory
    });
    this.client = new Client(
      {
        name: "learning-agent-paddleocr-client",
        version: "0.1.0"
      },
      {
        capabilities: {}
      }
    );
    this.client.onerror = (error) => {
      console.error("debugging: PaddleOCR MCP client error", error);
    };
    await this.client.connect(this.transport);
    console.log("debugging: PaddleOCR MCP connected");
    
    return this.client;
  }

  private parseDetailedResult(result: any): any {
    const textSegments = result.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text.trim())
      .filter(Boolean);
    if (textSegments.length === 0) {
      throw new Error("PaddleOCR MCP 未返回文本内容");
    }
    const candidate = [...textSegments]
      .reverse()
      .find((segment: string) => segment.startsWith("{") || segment.startsWith("["));
    if (!candidate) {
      throw new Error("PaddleOCR MCP detailed 输出不包含 JSON 片段");
    }
    try {
      return JSON.parse(candidate);
    } catch (error: any) {
      throw new Error(`无法解析 PaddleOCR MCP 输出: ${error.message}`);
    }
  }

  private toStructuredResult(raw: any, sourcePath: string): OcrStructuredResult {
    const plainText = (raw.text || "").trim();
    const lines = raw.text_lines ?? [];
    const spans: Array<OcrTextSpan> = lines.map((line: any, index: number) => {
      const confidence = line.confidence ?? raw.confidence ?? 0;
      return {
        lineId: `line-${index}`,
        text: (line.text || "").trim(),
        confidence,
        boundingBox: this.normalizeBoundingBox(line.bbox),
        classification: index === 0 ? "question" : "analysis",
        sourceMeta: {
          confidence: confidence.toFixed(3)
        }
      };
    });
    const fallbackLines = plainText ? plainText.split(/\r?\n/).filter(Boolean) : spans.map((span) => span.text);
    const markdownText = fallbackLines.map((line: string) => `- ${line}`).join("\n");
    const tableData = [["#", "内容", "置信度"]];
    spans.forEach((span, index) => {
      tableData.push([
        String(index + 1),
        span.text,
        span.confidence ? `${(span.confidence * 100).toFixed(1)}%` : "-"
      ]);
    });
    return {
      originalPath: sourcePath,
      plainText: plainText || spans.map((span) => span.text).join("\n"),
      markdownText,
      tableData,
      spans
    };
  }

  private normalizeBoundingBox(bbox: any): number[] {
    if (!bbox) {
      return [];
    }
    if (Array.isArray(bbox) && bbox.every((value) => typeof value === "number")) {
      return bbox;
    }
    if (Array.isArray(bbox)) {
      const flattened: number[] = [];
      for (const segment of bbox) {
        if (Array.isArray(segment)) {
          for (const value of segment) {
            if (typeof value === "number") {
              flattened.push(value);
            }
          }
        }
      }
      return flattened;
    }
    return [];
  }

  async dispose() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.connectPromise = null;
  }
}

