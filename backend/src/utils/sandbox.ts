import vm from "vm"; // 引入 Node 的 vm 模块用于沙箱执行。

/**
 * 定义沙箱选项，包含超时和可用模块映射。
 */
export interface SandboxOptions { // 导出沙箱选项接口。
  timeoutMs: number; // 超时时间（毫秒）。
  moduleMap: Record<string, unknown>; // 允许导入的模块映射。
}

/**
 * 定义沙箱执行结果结构。
 */
export interface SandboxResult { // 导出沙箱结果接口。
  success: boolean; // 是否执行成功。
  result?: unknown; // 成功时的返回值。
  logs: Array<string>; // 执行期间的日志。
  errorMessage?: string; // 失败时的错误信息。
}

/**
 * 创建安全的 require 函数，仅允许访问白名单模块。
 */
function createSandboxRequire(moduleMap: Record<string, unknown>, logs: Array<string>): (id: string) => unknown { // 构造 require 函数。
  return function sandboxRequire(id: string): unknown { // 返回带校验的 require。
    logs.push(`debugging: sandbox require ${id}`); // 记录尝试加载的模块。
    if (Object.prototype.hasOwnProperty.call(moduleMap, id)) { // 检查是否在白名单。
      return moduleMap[id]; // 返回映射模块。
    } // 条件结束。
    throw new Error(`Module '${id}' is not allowed in sandbox`); // 非白名单直接抛错。
  }; // 函数结束。
}

/**
 * 构建沙箱上下文，包含定制 console、module、exports 等。
 */
function createSandboxContext(moduleMap: Record<string, unknown>, logs: Array<string>): vm.Context { // 创建沙箱上下文。
  const sandboxConsole = { // 自定义 console。
    log: (...args: Array<unknown>) => { // 覆盖 log 方法。
      const serialized = args.map((arg) => String(arg)).join(" "); // 序列化日志参数。
      logs.push(`console.log ${serialized}`); // 写入内部日志。
    }, // 方法结束。
    error: (...args: Array<unknown>) => { // 覆盖 error 方法。
      const serialized = args.map((arg) => String(arg)).join(" "); // 序列化错误参数。
      logs.push(`console.error ${serialized}`); // 写入内部日志。
    } // 方法结束。
  }; // console 定义结束。

  const moduleShim = { exports: {} as Record<string, unknown> }; // 预置 module 对象。
  const context = { // 构造上下文字典。
    console: sandboxConsole, // 注入自定义 console。
    module: moduleShim, // 注入 module 对象。
    exports: moduleShim.exports, // 注入 exports 引用。
    require: createSandboxRequire(moduleMap, logs), // 注入安全 require。
    setTimeout, // 允许 setTimeout。
    clearTimeout // 允许 clearTimeout。
  }; // 上下文定义结束。

  return vm.createContext(context, { codeGeneration: { strings: true, wasm: false } }); // 创建并返回 vm 上下文。
}

/**
 * 在沙箱中执行代码字符串，返回结构化结果。
 */
export async function runCodeInSandbox(code: string, options: SandboxOptions): Promise<SandboxResult> { // 导出主执行函数。
  const logs: Array<string> = []; // 初始化日志数组。
  try { // 捕获执行异常。
    const timeoutMs = options.timeoutMs > 0 ? options.timeoutMs : 8000; // 计算有效超时。
    logs.push(`debugging: sandbox timeout ${timeoutMs}`); // 记录超时配置。
    const context = createSandboxContext(options.moduleMap, logs); // 创建沙箱上下文。
    const script = new vm.Script(code); // 编译脚本（超时在 runInContext 设置）。
    logs.push("debugging: sandbox script created"); // 记录脚本创建。
    script.runInContext(context, { timeout: timeoutMs }); // 在上下文中执行脚本。
    logs.push("debugging: sandbox script executed"); // 记录执行完成。
    const exportedMain = (context as unknown as { module: { exports: { main?: unknown } } }).module.exports.main; // 提取 main 函数。
    if (typeof exportedMain !== "function") { // 校验 main 是否存在。
      return { success: false, logs, errorMessage: "No main function exported from sandbox code" }; // 返回失败结果。
    } // 条件结束。
    const result = await (exportedMain as () => unknown)(); // 调用 main 并等待结果。
    logs.push("debugging: sandbox main resolved"); // 记录执行成功。
    return { success: true, result, logs }; // 返回成功结果。
  } catch (error: unknown) { // 捕获异常。
    const message = error instanceof Error ? error.message : String(error); // 生成错误信息。
    logs.push(`debugging: sandbox error ${message}`); // 记录错误日志。
    return { success: false, logs, errorMessage: message }; // 返回失败结果。
  } // try-catch 结束。
}

