# SSE (Server-Sent Events) 流式接口对接详细文档

## 目录

1. [SSE 基础概念](#sse-基础概念)
2. [SSE 数据格式规范](#sse-数据格式规范)
3. [EventSource API 详解](#eventsource-api-详解)
4. [常见问题与解决方案](#常见问题与解决方案)
5. [最佳实践](#最佳实践)
6. [调试技巧](#调试技巧)

---

## SSE 基础概念

### 什么是 SSE？

Server-Sent Events (SSE) 是一种服务器向客户端推送数据的技术。它基于 HTTP 协议，使用简单的文本格式，允许服务器主动向客户端发送数据流。

### SSE 的优势

- ✅ **简单易用**：基于 HTTP，无需特殊协议
- ✅ **自动重连**：浏览器原生支持自动重连机制
- ✅ **文本格式**：易于调试和理解
- ✅ **单向通信**：适合服务器向客户端推送数据

### SSE vs WebSocket

| 特性       | SSE                   | WebSocket   |
| ---------- | --------------------- | ----------- |
| 协议       | HTTP                  | WS/WSS      |
| 通信方向   | 单向（服务器→客户端） | 双向        |
| 数据格式   | 文本                  | 文本/二进制 |
| 浏览器支持 | 现代浏览器            | 现代浏览器  |
| 复杂度     | 低                    | 中          |

---

## SSE 数据格式规范

### 基本格式

SSE 消息必须遵循以下格式：

```
field: value\n
\n
```

**关键规则：**

1. 每行必须以 `field: value` 格式
2. 字段名和值之间用冒号和空格分隔（`:` 后面必须有一个空格）
3. 消息之间用**两个换行符**（`\n\n`）分隔
4. 如果值中包含换行符，需要转义

### 标准字段

- `data:` - 消息内容（必需）
- `event:` - 事件类型（可选，默认为 `message`）
- `id:` - 消息ID（可选，用于断线重连）
- `retry:` - 重连间隔（可选，毫秒）

### 数据格式示例

#### 示例 1：简单消息

```
data: Hello World\n
\n
```

#### 示例 2：JSON 数据

```
data: {"d":"Hello"}\n
\n
```

#### 示例 3：多行数据

```
data: Line 1\n
data: Line 2\n
\n
```

（会被合并为：`Line 1\nLine 2`）

#### 示例 4：自定义事件

```
event: custom\ndata: {"message":"custom event"}\n
\n
```

#### 示例 5：流式数据 + 结束事件（您的场景）

```
data: {"d":"。"}\n
\n
event: done\ndata:\n
\n
```

**重要说明：**

- 第一个消息块：`data: {"d":"。"}\n\n` - 这是默认消息，会触发 `onmessage`
- 第二个消息块：`event: done\ndata:\n\n` - 这是自定义事件，会触发 `addEventListener('done')`

---

## EventSource API 详解

### 创建连接

```javascript
const eventSource = new EventSource(url, {
  withCredentials: true, // 是否发送凭证（Cookie）
})
```

### 事件处理

#### 1. 默认消息事件（`onmessage`）

**触发条件：** 接收到没有 `event:` 字段或 `event: message` 的消息

```javascript
eventSource.onmessage = function (event) {
  console.log('收到消息:', event.data)
  // event.data 包含 data: 字段的值
}
```

**重要：** `onmessage` **只能**处理默认消息事件。如果消息包含 `event: done`，`onmessage` **不会触发**！

#### 2. 自定义事件（`addEventListener`）

**触发条件：** 接收到包含 `event:` 字段的消息

```javascript
eventSource.addEventListener('done', function (event) {
  console.log('收到 done 事件:', event.data)
  // event.data 包含 data: 字段的值
})
```

**关键点：**

- 自定义事件**必须**使用 `addEventListener` 监听
- `onmessage` **不会**处理自定义事件
- 事件名称必须与服务器发送的 `event:` 值完全匹配（区分大小写）

#### 3. 错误处理（`onerror`）

```javascript
eventSource.onerror = function (error) {
  console.error('SSE 连接错误:', error)

  // readyState 状态：
  // 0 = CONNECTING (正在连接)
  // 1 = OPEN (已连接)
  // 2 = CLOSED (已关闭)

  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('连接已关闭')
  }
}
```

#### 4. 连接打开（`onopen`）

```javascript
eventSource.onopen = function (event) {
  console.log('SSE 连接已建立')
}
```

### 关闭连接

```javascript
eventSource.close()
```

**注意：** 关闭后无法自动重连，需要重新创建 EventSource 实例。

---

## 常见问题与解决方案

### 问题 1：数据流式返回但界面不显示

#### 症状

- 接口正常返回流式数据
- 浏览器网络面板显示数据在传输
- 但页面没有任何更新

#### 可能原因

**原因 1：事件监听器配置错误**

```javascript
// ❌ 错误：done 事件不会触发 onmessage
eventSource.onmessage = function (event) {
  if (event.type === 'done') {
    // 永远不会执行
    // ...
  }
}

// ✅ 正确：使用 addEventListener 监听自定义事件
eventSource.addEventListener('done', function (event) {
  // 处理 done 事件
})
```

**原因 2：数据格式解析错误**

```javascript
// ❌ 错误：直接使用 event.data，可能不是 JSON
eventSource.onmessage = function (event) {
  const content = event.data.d // 错误！event.data 是字符串
}

// ✅ 正确：先解析 JSON
eventSource.onmessage = function (event) {
  try {
    const parsed = JSON.parse(event.data)
    const content = parsed.d
    // 使用 content
  } catch (error) {
    console.error('解析失败:', error)
  }
}
```

**原因 3：Vue 响应式更新问题**

```javascript
// ❌ 错误：直接修改数组元素可能不会触发响应式更新
messages.value[aiMessageIndex].content = fullContent

// ✅ 正确：确保响应式更新
messages.value[aiMessageIndex] = {
  ...messages.value[aiMessageIndex],
  content: fullContent
}

// 或者使用 Vue 3 的响应式 API
import { reactive, ref } from 'vue'
const messages = ref([...])
// 直接修改 ref 的值会自动触发更新
```

**原因 4：消息格式不匹配**

如果服务器发送的格式是：

```
data: {"d":"。"}\nevent:done\ndata:\n\n
```

这会被解析为**一个** `done` 事件，而不是默认消息。需要使用：

```javascript
eventSource.addEventListener('done', function (event) {
  // 这里 event.data 可能是空字符串或最后一个 data: 的值
})
```

### 问题 2：done 事件无法触发

#### 症状

- 流式数据正常接收
- 但 `done` 事件监听器从未触发

#### 解决方案

**检查 1：事件名称是否匹配**

```javascript
// 服务器发送：event: done
// ✅ 正确
eventSource.addEventListener('done', handler)

// ❌ 错误：大小写不匹配
eventSource.addEventListener('Done', handler) // 不会触发
eventSource.addEventListener('DONE', handler) // 不会触发
```

**检查 2：消息格式是否正确**

服务器必须发送：

```
event: done\ndata:\n\n
```

而不是：

```
data: done\n\n  // 这会被 onmessage 接收，不是 done 事件
```

**检查 3：在连接建立前添加监听器**

```javascript
// ✅ 正确：在创建连接后立即添加监听器
const eventSource = new EventSource(url)
eventSource.addEventListener('done', handler)
eventSource.onmessage = messageHandler

// ❌ 错误：延迟添加可能错过事件
const eventSource = new EventSource(url)
eventSource.onmessage = messageHandler
// ... 其他代码 ...
eventSource.addEventListener('done', handler) // 可能已经错过了
```

### 问题 3：数据重复或丢失

#### 症状

- 数据重复显示
- 或部分数据丢失

#### 解决方案

**使用标志位防止重复处理**

```javascript
let streamCompleted = false

eventSource.onmessage = function (event) {
  if (streamCompleted) return // 防止重复处理

  // 处理消息
}

eventSource.addEventListener('done', function (event) {
  if (streamCompleted) return // 防止重复处理

  streamCompleted = true
  eventSource.close()
})
```

**累积数据而不是替换**

```javascript
let fullContent = '' // 在外部定义，累积所有内容

eventSource.onmessage = function (event) {
  try {
    const parsed = JSON.parse(event.data)
    const content = parsed.d

    if (content !== undefined && content !== null) {
      fullContent += content // 累积，不是替换
      messages.value[aiMessageIndex].content = fullContent
    }
  } catch (error) {
    console.error('解析失败:', error)
  }
}
```

### 问题 4：连接自动关闭

#### 症状

- 连接建立后立即关闭
- 无法接收数据

#### 解决方案

**检查 CORS 配置**

```javascript
// 后端必须设置正确的 CORS 头
// Access-Control-Allow-Origin: *
// Access-Control-Allow-Credentials: true
// Content-Type: text/event-stream
// Cache-Control: no-cache
```

**检查认证信息**

```javascript
// 如果需要发送 Cookie
const eventSource = new EventSource(url, {
  withCredentials: true,
})
```

**检查 URL 格式**

```javascript
// ✅ 正确：GET 请求，参数在 URL 中
const url = `${baseURL}/app/chat/gen/code?appId=123&message=hello`

// ❌ 错误：EventSource 不支持 POST
// EventSource 只支持 GET 请求
```

---

## 最佳实践

### 1. 完整的 SSE 处理流程

```javascript
async function handleSSEStream(userMessage, aiMessageIndex) {
  let eventSource = null
  let streamCompleted = false
  let fullContent = ''

  try {
    // 1. 构建 URL
    const baseURL = 'http://localhost:8123/api'
    const params = new URLSearchParams({
      appId: appId.value || '',
      message: userMessage,
    })
    const url = `${baseURL}/app/chat/gen/code?${params}`

    // 2. 创建连接
    eventSource = new EventSource(url, {
      withCredentials: true,
    })

    // 3. 监听连接打开
    eventSource.onopen = function () {
      console.log('SSE 连接已建立')
    }

    // 4. 处理默认消息（流式数据）
    eventSource.onmessage = function (event) {
      if (streamCompleted) return

      try {
        // 解析 JSON 数据
        const parsed = JSON.parse(event.data)
        const content = parsed.d

        // 累积内容
        if (content !== undefined && content !== null) {
          fullContent += content

          // 更新 UI（确保响应式更新）
          messages.value[aiMessageIndex] = {
            ...messages.value[aiMessageIndex],
            content: fullContent,
            loading: false,
          }

          // 滚动到底部
          scrollToBottom()
        }
      } catch (error) {
        console.error('解析消息失败:', error)
        // 如果解析失败，可能是非 JSON 格式，直接使用原始数据
        if (event.data) {
          fullContent += event.data
          messages.value[aiMessageIndex].content = fullContent
        }
      }
    }

    // 5. 监听自定义事件（结束标志）
    eventSource.addEventListener('done', function (event) {
      if (streamCompleted) return

      console.log('收到 done 事件，流式传输完成')
      streamCompleted = true
      isGenerating.value = false

      // 关闭连接
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }

      // 执行后续操作（如更新预览）
      setTimeout(async () => {
        await fetchAppInfo()
        updatePreview()
      }, 1000)
    })

    // 6. 处理错误
    eventSource.onerror = function (error) {
      // 如果已经完成，忽略错误
      if (streamCompleted || !isGenerating.value) return

      console.error('SSE 连接错误:', error)

      // 检查连接状态
      if (eventSource?.readyState === EventSource.CLOSED) {
        // 连接已关闭，可能是正常结束
        if (!streamCompleted) {
          // 如果没有收到 done 事件就关闭了，可能是异常
          handleError(new Error('SSE 连接意外关闭'), aiMessageIndex)
        }
      } else if (eventSource?.readyState === EventSource.CONNECTING) {
        // 正在重连，可能是网络问题
        console.log('SSE 正在重连...')
      }
    }
  } catch (error) {
    console.error('创建 EventSource 失败：', error)
    handleError(error, aiMessageIndex)
  }

  // 7. 返回清理函数（可选）
  return function cleanup() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    streamCompleted = true
  }
}
```

### 2. Vue 3 响应式更新最佳实践

```javascript
// ✅ 推荐：使用 ref 和直接赋值
const messages = ref<Message[]>([])

// 更新消息内容
messages.value[aiMessageIndex] = {
  ...messages.value[aiMessageIndex],
  content: fullContent,
  loading: false,
}

// ✅ 或者使用 nextTick 确保 DOM 更新
import { nextTick } from 'vue'

eventSource.onmessage = async function(event) {
  // ... 处理数据 ...

  messages.value[aiMessageIndex].content = fullContent

  await nextTick()
  scrollToBottom()  // 确保 DOM 更新后再滚动
}
```

### 3. 错误处理最佳实践

```javascript
function handleError(error: unknown, aiMessageIndex: number) {
  console.error('生成代码失败：', error)

  // 更新消息状态
  messages.value[aiMessageIndex] = {
    ...messages.value[aiMessageIndex],
    content: '抱歉，生成过程中出现了错误，请重试。',
    loading: false,
  }

  // 更新全局状态
  isGenerating.value = false

  // 显示错误提示
  message.error('生成失败，请重试')

  // 关闭连接（如果存在）
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}
```

### 4. 资源清理最佳实践

```javascript
import { onUnmounted } from 'vue'

// 存储所有活跃的连接
const activeConnections = new Set<EventSource>()

function createSSEConnection(url: string) {
  const eventSource = new EventSource(url)
  activeConnections.add(eventSource)

  // 添加清理逻辑
  eventSource.addEventListener('done', function() {
    activeConnections.delete(eventSource)
    eventSource.close()
  })

  eventSource.onerror = function() {
    if (eventSource.readyState === EventSource.CLOSED) {
      activeConnections.delete(eventSource)
    }
  }

  return eventSource
}

// 组件卸载时清理所有连接
onUnmounted(() => {
  activeConnections.forEach(conn => {
    conn.close()
  })
  activeConnections.clear()
})
```

---

## 调试技巧

### 1. 使用浏览器开发者工具

**Network 面板：**

- 找到 SSE 请求（类型为 `eventsource`）
- 点击查看 "EventStream" 标签
- 可以看到实时接收的消息

**Console 面板：**

```javascript
// 添加详细日志
eventSource.onmessage = function (event) {
  console.log('收到消息:', {
    type: event.type,
    data: event.data,
    lastEventId: event.lastEventId,
    origin: event.origin,
  })
}

eventSource.addEventListener('done', function (event) {
  console.log('收到 done 事件:', {
    type: event.type,
    data: event.data,
  })
})
```

### 2. 验证数据格式

```javascript
// 在 onmessage 中打印原始数据
eventSource.onmessage = function (event) {
  console.log('原始数据:', event.data)
  console.log('数据类型:', typeof event.data)

  // 尝试解析
  try {
    const parsed = JSON.parse(event.data)
    console.log('解析后的数据:', parsed)
  } catch (e) {
    console.error('不是有效的 JSON:', e)
  }
}
```

### 3. 检查连接状态

```javascript
// 定期检查连接状态
setInterval(() => {
  if (eventSource) {
    console.log('连接状态:', {
      readyState: eventSource.readyState,
      url: eventSource.url,
      withCredentials: eventSource.withCredentials,
    })
  }
}, 1000)
```

### 4. 模拟服务器响应

```javascript
// 使用 Mock Service Worker 或类似工具模拟 SSE 响应
// 确保格式完全正确：
// data: {"d":"test"}\n\n
// event: done\ndata:\n\n
```

---

## 总结

### 关键要点

1. **事件类型区分**
   - 默认消息 → 使用 `onmessage`
   - 自定义事件 → 使用 `addEventListener('eventName')`

2. **数据格式**
   - 服务器必须发送正确的 SSE 格式
   - 消息之间用 `\n\n` 分隔
   - 字段格式：`field: value\n`

3. **响应式更新**
   - Vue 3 中确保正确更新响应式数据
   - 使用 `nextTick` 确保 DOM 更新

4. **错误处理**
   - 检查连接状态
   - 处理解析错误
   - 防止重复处理

5. **资源清理**
   - 组件卸载时关闭连接
   - 使用标志位防止重复处理

### 常见错误检查清单

- [ ] `done` 事件是否使用 `addEventListener` 而不是 `onmessage`？
- [ ] 事件名称是否与服务器发送的完全匹配（大小写敏感）？
- [ ] 数据解析是否正确（JSON.parse）？
- [ ] Vue 响应式数据是否正确更新？
- [ ] 是否在连接建立前添加了所有监听器？
- [ ] 是否处理了连接错误和异常情况？
- [ ] 是否在适当时机关闭了连接？

---

## 针对您的代码的具体分析

### 您的数据格式

根据您提供的数据格式：

```
data:{"d":"。"}
event:done
data:
```

这表示服务器发送了两个独立的消息块：

1. **第一个消息块**（流式数据）：

   ```
   data:{"d":"。"}\n\n
   ```

   - 这会触发 `onmessage` 事件
   - `event.data` 的值是：`{"d":"。"}`

2. **第二个消息块**（结束标志）：
   ```
   event:done\ndata:\n\n
   ```

   - 这会触发 `addEventListener('done')` 事件
   - `event.data` 的值是：空字符串（因为 `data:` 后面没有值）

### 可能的问题点

#### 问题 1：Vue 响应式更新可能失效

**您的代码：**

```javascript
messages.value[aiMessageIndex].content = fullContent
```

**潜在问题：**
直接修改数组元素的属性可能不会触发 Vue 的响应式更新，特别是在某些情况下。

**解决方案：**

```javascript
// 方式 1：使用对象展开（推荐）
messages.value[aiMessageIndex] = {
  ...messages.value[aiMessageIndex],
  content: fullContent,
  loading: false,
}

// 方式 2：使用 Vue 3 的响应式 API
import { triggerRef } from 'vue'
messages.value[aiMessageIndex].content = fullContent
triggerRef(messages) // 强制触发更新

// 方式 3：使用 nextTick 确保更新
import { nextTick } from 'vue'
messages.value[aiMessageIndex].content = fullContent
await nextTick()
scrollToBottom()
```

#### 问题 2：解析错误处理过于严格

**您的代码：**

```javascript
eventSource.onmessage = function (event) {
  try {
    const parsed = JSON.parse(event.data)
    const content = parsed.d
    // ...
  } catch (error) {
    console.error('解析消息失败:', error)
    handleError(error, aiMessageIndex) // 这里会中断整个流程
  }
}
```

**潜在问题：**
如果某一条消息解析失败，会调用 `handleError`，这可能不是您想要的。应该只记录错误，继续处理后续消息。

**解决方案：**

```javascript
eventSource.onmessage = function (event) {
  if (streamCompleted) return

  try {
    const parsed = JSON.parse(event.data)
    const content = parsed.d

    if (content !== undefined && content !== null) {
      fullContent += content
      messages.value[aiMessageIndex] = {
        ...messages.value[aiMessageIndex],
        content: fullContent,
        loading: false,
      }
      scrollToBottom()
    }
  } catch (error) {
    // 只记录错误，不中断流程
    console.error('解析消息失败:', error, '原始数据:', event.data)

    // 如果解析失败，尝试直接使用原始数据
    if (event.data && typeof event.data === 'string') {
      fullContent += event.data
      messages.value[aiMessageIndex] = {
        ...messages.value[aiMessageIndex],
        content: fullContent,
        loading: false,
      }
    }
  }
}
```

#### 问题 3：done 事件处理中缺少数据检查

**您的代码：**

```javascript
eventSource.addEventListener('done', function () {
  // 没有检查 event.data
})
```

**建议：**
虽然 `done` 事件的 `data:` 通常是空的，但最好还是检查一下：

```javascript
eventSource.addEventListener('done', function (event) {
  if (streamCompleted) return

  console.log('收到 done 事件，数据:', event.data)

  // 如果 done 事件也包含数据，可以追加
  if (event.data) {
    try {
      const parsed = JSON.parse(event.data)
      if (parsed.d) {
        fullContent += parsed.d
        messages.value[aiMessageIndex].content = fullContent
      }
    } catch (e) {
      // 忽略解析错误
    }
  }

  streamCompleted = true
  isGenerating.value = false
  eventSource?.close()

  setTimeout(async () => {
    await fetchAppInfo()
    updatePreview()
  }, 1000)
})
```

#### 问题 4：缺少连接状态日志

**建议添加调试日志：**

```javascript
// 在创建连接后
eventSource.onopen = function () {
  console.log('✅ SSE 连接已建立')
}

eventSource.onmessage = function (event) {
  console.log('📨 收到消息:', {
    data: event.data,
    type: event.type,
    lastEventId: event.lastEventId,
  })
  // ... 处理逻辑
}

eventSource.addEventListener('done', function (event) {
  console.log('✅ 收到 done 事件:', {
    data: event.data,
    type: event.type,
  })
  // ... 处理逻辑
})

eventSource.onerror = function (error) {
  console.error('❌ SSE 错误:', {
    readyState: eventSource?.readyState,
    error: error,
  })
  // ... 处理逻辑
}
```

### 调试步骤

1. **打开浏览器开发者工具**
   - 切换到 Network 面板
   - 找到类型为 `eventsource` 的请求
   - 点击查看 "EventStream" 标签页
   - 观察实时接收的消息

2. **添加 Console 日志**
   - 在 `onmessage` 中添加 `console.log('收到消息:', event.data)`
   - 在 `addEventListener('done')` 中添加 `console.log('收到 done 事件')`
   - 检查这些日志是否正常输出

3. **检查 Vue 响应式**
   - 在更新消息后，添加 `console.log('消息数组:', messages.value)`
   - 检查 `messages.value[aiMessageIndex].content` 是否正确更新

4. **验证数据格式**
   - 在 Network 面板中查看原始响应
   - 确认格式是否为：
     ```
     data:{"d":"。"}\n\n
     event:done\ndata:\n\n
     ```

### 完整的改进版本（参考）

```javascript
const generateCode = async (userMessage: string, aiMessageIndex: number) => {
  let eventSource: EventSource | null = null
  let streamCompleted = false
  let fullContent = ''

  try {
    const baseURL = request.defaults.baseURL || API_BASE_URL
    const params = new URLSearchParams({
      appId: appId.value || '',
      message: userMessage,
    })
    const url = `${baseURL}/app/chat/gen/code?${params}`

    console.log('🔗 创建 SSE 连接:', url)
    eventSource = new EventSource(url, {
      withCredentials: true,
    })

    // 连接打开
    eventSource.onopen = function() {
      console.log('✅ SSE 连接已建立')
    }

    // 处理流式数据
    eventSource.onmessage = function (event) {
      if (streamCompleted) {
        console.warn('⚠️ 流已完成，忽略消息')
        return
      }

      console.log('📨 收到消息:', event.data)

      try {
        const parsed = JSON.parse(event.data)
        const content = parsed.d

        if (content !== undefined && content !== null) {
          fullContent += content

          // 确保响应式更新
          messages.value[aiMessageIndex] = {
            ...messages.value[aiMessageIndex],
            content: fullContent,
            loading: false,
          }

          console.log('✅ 更新消息内容，长度:', fullContent.length)

          // 使用 nextTick 确保 DOM 更新
          nextTick(() => {
            scrollToBottom()
          })
        }
      } catch (error) {
        console.error('❌ 解析消息失败:', error, '原始数据:', event.data)
        // 不中断流程，尝试直接使用原始数据
        if (event.data) {
          fullContent += event.data
          messages.value[aiMessageIndex] = {
            ...messages.value[aiMessageIndex],
            content: fullContent,
            loading: false,
          }
        }
      }
    }

    // 处理 done 事件
    eventSource.addEventListener('done', function (event) {
      if (streamCompleted) {
        console.warn('⚠️ 流已完成，忽略 done 事件')
        return
      }

      console.log('✅ 收到 done 事件，流式传输完成')

      streamCompleted = true
      isGenerating.value = false

      if (eventSource) {
        eventSource.close()
        eventSource = null
      }

      // 延迟更新预览
      setTimeout(async () => {
        await fetchAppInfo()
        updatePreview()
      }, 1000)
    })

    // 处理错误
    eventSource.onerror = function (error) {
      if (streamCompleted || !isGenerating.value) {
        return
      }

      console.error('❌ SSE 连接错误:', {
        readyState: eventSource?.readyState,
        error: error,
      })

      if (eventSource?.readyState === EventSource.CLOSED) {
        // 连接已关闭
        if (!streamCompleted) {
          console.warn('⚠️ 连接意外关闭，未收到 done 事件')
          handleError(new Error('SSE 连接意外关闭'), aiMessageIndex)
        }
      } else if (eventSource?.readyState === EventSource.CONNECTING) {
        // 正在重连
        console.log('🔄 SSE 正在重连...')
      }
    }
  } catch (error) {
    console.error('❌ 创建 EventSource 失败：', error)
    handleError(error, aiMessageIndex)
  }
}
```

---

## URL 编码说明（解答您的疑问）

### 为什么 `size: 2` 但 URL 很长？

您可能注意到：

- `URLSearchParams {size: 2}` - 只有 2 个参数
- 但最终的 URL 很长：`http://localhost:8123/api/app/chat/gen/code?appId=363236256290664448&messag%EF%BC%8C%E4%B8%8D%E8%B6%85%E8%BF%8720%E8%A1%8C%E4%BB%A3%E7%A0%81...`

### 原因解释

#### 1. `size: 2` 的含义

`size: 2` 表示**参数的数量**，不是参数值的长度！

```javascript
const params = new URLSearchParams({
  appId: '363236256290664448', // 参数 1
  message: '，不超过20行代码...', // 参数 2
})

console.log(params.size) // 输出: 2（表示有2个参数）
```

#### 2. URL 编码（URL Encoding）

**为什么中文会变长？**

URL 中只能包含 ASCII 字符。中文字符和特殊字符必须进行**URL 编码**（也叫百分号编码）。

**编码规则：**

- 每个非 ASCII 字符会被转换为 `%XX` 格式
- 中文字符在 UTF-8 编码下，每个字符通常需要 **3 个字节**
- 所以一个中文字符会被编码成 **9 个字符**（`%XX%XX%XX`）

**示例：**

```javascript
// 原始文本
const message = '，不超过20行代码'

// URL 编码后
// ， → %EF%BC%8C
// 不 → %E4%B8%8D
// 超 → %E8%B6%85
// 过 → %E8%BF%87
// 2 → 2（数字不需要编码）
// 0 → 0（数字不需要编码）
// 行 → %E8%A1%8C
// 代 → %E4%BB%A3
// 码 → %E7%A0%81

// 所以最终 URL 中显示为：
// messag%EF%BC%8C%E4%B8%8D%E8%B6%85%E8%BF%8720%E8%A1%8C%E4%BB%A3%E7%A0%81
```

#### 3. 实际演示

```javascript
// 创建参数
const params = new URLSearchParams({
  appId: '363236256290664448',
  message: '，不超过20行代码',
})

console.log('参数数量:', params.size) // 2
console.log('appId 值:', params.get('appId')) // 363236256290664448
console.log('message 值:', params.get('message')) // ，不超过20行代码

// 转换为 URL 字符串
const urlString = params.toString()
console.log('URL 字符串:', urlString)
// 输出: appId=363236256290664448&message=%EF%BC%8C%E4%B8%8D%E8%B6%85%E8%BF%8720%E8%A1%8C%E4%BB%A3%E7%A0%81

// 可以看到 message 参数被编码了
```

#### 4. URLSearchParams 自动处理编码

**好消息：** `URLSearchParams` 会自动处理编码和解码！

```javascript
// ✅ 正确：直接传入原始值，URLSearchParams 会自动编码
const params = new URLSearchParams({
  message: '，不超过20行代码', // 直接传入中文
})
const url = `http://localhost:8123/api/app/chat/gen/code?${params}`
// URL 会自动包含编码后的值

// ❌ 错误：手动编码会导致双重编码
const encoded = encodeURIComponent('，不超过20行代码')
const params2 = new URLSearchParams({
  message: encoded, // 已经编码过的值，会被再次编码！
})
```

#### 5. 验证编码是否正确

您可以在浏览器控制台验证：

```javascript
// 创建参数
const params = new URLSearchParams({
  appId: '363236256290664448',
  message: '，不超过20行代码',
})

// 查看编码后的字符串
console.log('编码后的字符串:', params.toString())

// 查看解码后的值（验证是否正确）
console.log('解码后的 message:', params.get('message'))

// 查看完整的 URL
const baseURL = 'http://localhost:8123/api'
const url = `${baseURL}/app/chat/gen/code?${params}`
console.log('完整 URL:', url)

// 验证：从 URL 中解析参数
const urlObj = new URL(url)
const parsedParams = new URLSearchParams(urlObj.search)
console.log('解析后的 message:', parsedParams.get('message'))
// 应该输出: ，不超过20行代码
```

#### 6. 为什么 URL 很长？

**总结：**

1. **参数数量**：`size: 2` 表示有 2 个参数（appId 和 message）
2. **参数值长度**：message 的值可能很长（包含很多中文字符）
3. **URL 编码**：每个中文字符被编码成 9 个字符（`%XX%XX%XX`）
4. **最终结果**：URL 变长是正常的，因为：
   - appId 值本身就很长（19 位数字）
   - message 包含中文，编码后变得更长

**这是完全正常的！** 浏览器和后端服务器会自动处理编码和解码，您不需要手动处理。

#### 7. 如果 URL 太长怎么办？

如果 URL 太长（超过浏览器限制，通常 2048 字符），可以考虑：

**方案 1：使用 POST 请求（但 EventSource 不支持 POST）**

```javascript
// EventSource 只支持 GET，所以不能使用 POST
// 如果必须使用 POST，需要使用 fetch + ReadableStream
```

**方案 2：压缩消息内容**

```javascript
// 在发送前压缩消息（如果可能）
const compressedMessage = compressMessage(userMessage)
```

**方案 3：使用 fetch + ReadableStream（替代 EventSource）**

如果 URL 太长，可以考虑使用 `fetch` API 配合 `ReadableStream`：

```javascript
// 使用 POST 请求发送长消息
const response = await fetch(`${baseURL}/app/chat/gen/code`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    appId: appId.value,
    message: userMessage, // 可以很长，不受 URL 长度限制
  }),
})

// 读取流式响应
const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value)
  // 处理 SSE 格式的数据块
  // ...
}
```

**但对于您当前的场景，URL 长度通常不是问题，因为：**

- 现代浏览器支持很长的 URL（通常 8000+ 字符）
- EventSource 会自动处理编码
- 后端会自动解码参数

---

## 参考资源

- [MDN: Server-Sent Events](https://developer.mozilla.org/zh-CN/docs/Web/API/Server-sent_events)
- [MDN: EventSource API](https://developer.mozilla.org/zh-CN/docs/Web/API/EventSource)
- [W3C: Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Vue 3 响应式系统文档](https://cn.vuejs.org/guide/essentials/reactivity-fundamentals.html)

---

**文档版本：** 1.0  
**最后更新：** 2024年
