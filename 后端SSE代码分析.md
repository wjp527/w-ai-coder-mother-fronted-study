# 后端 SSE 代码分析：刷新延迟问题根源

## 一、代码流程分析

### 1. Controller 层（AppController.java）

```java
@GetMapping(value = "/chat/gen/code", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> chatToGenCode(@RequestParam Long appId,
                                                   @RequestParam String message,
                                                   HttpServletRequest request) {
    // 1. 参数校验
    // 2. 获取登录用户
    User loginUser = userService.getLoginUser(request);
    
    // 3. 调用服务生成代码（流式）
    Flux<String> contentFlux = appService.chatToGenCode(appId, message, loginUser);
    
    // 4. 转换为 ServerSentEvent 格式
    return contentFlux
        .map(chunk -> {
            Map<String, String> wrapper = Map.of("d", chunk);
            String jsonData = JSONUtil.toJsonStr(wrapper);
            return ServerSentEvent.<String>builder()
                .data(jsonData)
                .build();
        })
        .concatWith(Mono.just(
            ServerSentEvent.<String>builder()
                .event("done")
                .data("")
                .build()
        ));
}
```

**关键点：**
- ✅ 使用 Spring WebFlux 的 `Flux` 和 `ServerSentEvent`
- ✅ 正确设置了 `TEXT_EVENT_STREAM_VALUE` 响应类型
- ❌ **没有连接检测机制**
- ❌ **没有取消机制**

### 2. Service 层（AppServiceImpl.java）

```java
@Override
public Flux<String> chatToGenCode(Long appId, String message, User loginUser) {
    // 1. 参数校验
    // 2. 查询应用信息
    // 3. 权限校验
    // 4. 获取代码生成类型
    // 5. 调用 AI 服务生成代码
    return aiCodeGeneratorFacade.generateAndSaveCodeStream(message, codeGenTypeEnum, appId, version);
}
```

**关键点：**
- ✅ 简单的委托调用
- ❌ **没有连接检测**
- ❌ **没有并发控制**

### 3. Facade 层（AiCodeGeneratorFacade.java）

```java
public Flux<String> generateAndSaveCodeStream(String userMessage, CodeGenTypeEnum codeGenTypeEnum, Long appId, int version) {
    return switch(codeGenTypeEnum) {
        case HTML -> {
            Flux<String> result = aiCodeGeneratorService.generateHtmlCodeStream(userMessage);
            yield processCodeStream(result, CodeGenTypeEnum.HTML, appId, version);
        }
        case MULTI_FILE -> {
            Flux<String> result = aiCodeGeneratorService.generateMultiFileCodeStream(userMessage);
            yield processCodeStream(result, CodeGenTypeEnum.MULTI_FILE, appId, version);
        }
    };
}

private Flux<String> processCodeStream(Flux<String> codeStream, CodeGenTypeEnum codeGenTypeEnum, Long appId, int version) {
    StringBuilder codeBuilder = new StringBuilder();
    
    return codeStream
        .doOnNext(chunk -> {
            // 实时收集代码块
            codeBuilder.append(chunk);
        })
        .doOnComplete(() -> {
            try {
                // 流式输出完成后，保存代码
                String completeCode = codeBuilder.toString();
                Object multiFileCodeResult = CodeParserExecutor.executeParser(completeCode, codeGenTypeEnum);
                File file = CodeFileSaverExecutor.saveCode(multiFileCodeResult, codeGenTypeEnum, appId, version);
                log.info("保存成功,目录为:{}", file.getAbsolutePath());
            } catch(Exception e) {
                log.error("保存代码失败", e);
            }
        });
}
```

**关键点：**
- ✅ 使用 `doOnNext` 收集代码块
- ✅ 使用 `doOnComplete` 在流完成后保存文件
- ❌ **`doOnComplete` 是同步执行的**，会阻塞直到文件保存完成
- ❌ **没有连接检测**，即使前端断开，也会继续处理
- ❌ **没有取消机制**，无法中断正在处理的流

---

## 二、问题根源分析

### 问题 1：没有连接检测机制 ⚠️

**当前代码：**
```java
return contentFlux
    .map(chunk -> { ... })
    .concatWith(Mono.just(...));
```

**问题：**
- Flux 不知道前端是否断开连接
- 即使前端刷新页面，Flux 也会继续处理
- AI 模型调用、代码解析、文件保存都会继续执行

**影响：**
- 如果前端刷新，旧的 Flux 还在处理
- 新请求可能被阻塞（如果有资源锁定）
- 浪费服务器资源

### 问题 2：文件保存是同步的 ⚠️

**当前代码：**
```java
.doOnComplete(() -> {
    // 同步执行文件保存
    String completeCode = codeBuilder.toString();
    Object multiFileCodeResult = CodeParserExecutor.executeParser(completeCode, codeGenTypeEnum);
    File file = CodeFileSaverExecutor.saveCode(multiFileCodeResult, codeGenTypeEnum, appId, version);
});
```

**问题：**
- `doOnComplete` 是同步执行的
- 文件保存操作可能很耗时（解析代码、写入文件）
- 如果前端断开，这个操作也会继续执行

**影响：**
- 如果前端刷新，旧请求的文件保存操作还在执行
- 可能造成文件锁定或资源竞争
- 新请求可能需要等待旧请求完成

### 问题 3：没有取消机制 ⚠️

**当前代码：**
```java
Flux<String> contentFlux = appService.chatToGenCode(appId, message, loginUser);
return contentFlux.map(...);
```

**问题：**
- 没有检查连接是否断开
- 没有提供取消 Flux 的机制
- 即使前端断开，Flux 也会继续执行

**影响：**
- 无法中断正在处理的请求
- 资源浪费
- 可能导致延迟

### 问题 4：可能有资源锁定 ⚠️

**推测：**
- 文件保存操作可能对同一应用的文件加锁
- 如果旧请求还在保存文件，新请求可能被阻塞

**验证方法：**
```java
// 在 CodeFileSaverExecutor.saveCode 中添加日志
log.info("开始保存文件，appId: {}, version: {}", appId, version);
File file = CodeFileSaverExecutor.saveCode(...);
log.info("文件保存完成，appId: {}, version: {}", appId, version);
```

---

## 三、Spring WebFlux 的连接检测机制

### 1. 如何检测连接断开？

**方法 1：使用 `takeUntil` 检测连接状态**

```java
// 伪代码示例
return contentFlux
    .takeUntil(chunk -> {
        // 检查连接是否断开
        // 注意：这需要访问 HttpServletResponse
        return isConnectionClosed();
    })
    .map(chunk -> { ... });
```

**问题：**
- Controller 层返回的是 `Flux`，无法直接访问 `HttpServletResponse`
- Spring WebFlux 会自动处理连接断开，但可能不够及时

**方法 2：使用 `doOnCancel` 处理取消**

```java
return contentFlux
    .doOnCancel(() -> {
        log.info("Flux 被取消，可能是客户端断开连接");
        // 清理资源
    })
    .map(chunk -> { ... });
```

**问题：**
- `doOnCancel` 只在 Flux 被取消时触发
- 如果前端刷新，Flux 可能不会被立即取消

### 2. Spring WebFlux 的自动处理

**Spring WebFlux 的行为：**
- 当客户端断开连接时，Spring 会尝试取消订阅 Flux
- 但这个过程可能不是立即的
- 如果 Flux 正在执行阻塞操作（如文件保存），可能无法立即取消

**验证方法：**
```java
return contentFlux
    .doOnCancel(() -> log.info("Flux 被取消"))
    .doOnTerminate(() -> log.info("Flux 终止"))
    .doOnError(error -> log.error("Flux 错误", error))
    .map(chunk -> { ... });
```

---

## 四、刷新延迟的真正原因

### 场景重现

1. **用户发送消息：**
   ```
   前端：创建 EventSource 连接
   后端：创建 Flux，开始调用 AI 模型
   ```

2. **AI 开始流式返回：**
   ```
   后端：AI 模型返回代码块
   后端：通过 Flux 发送给前端
   前端：接收并显示代码块
   ```

3. **用户刷新页面：**
   ```
   前端：浏览器取消 EventSource 连接 ✅
   后端：❌ Flux 可能还在处理
   后端：❌ AI 模型调用可能还在进行
   后端：❌ 代码解析和文件保存可能还在执行
   ```

4. **用户刷新后发送新消息：**
   ```
   前端：创建新的 EventSource 连接
   后端：创建新的 Flux
   后端：❌ 如果旧请求还在保存文件，可能被阻塞
   后端：❌ 如果文件被锁定，新请求需要等待
   ```

### 最可能的原因

#### 原因 1：文件保存操作阻塞（最可能）

**问题流程：**
1. 旧请求的 `doOnComplete` 正在执行文件保存
2. 文件保存是同步的，可能需要几秒钟
3. 如果同一应用的文件被锁定，新请求需要等待

**验证方法：**
```java
.doOnComplete(() -> {
    long startTime = System.currentTimeMillis();
    log.info("开始保存文件，appId: {}", appId);
    
    String completeCode = codeBuilder.toString();
    Object multiFileCodeResult = CodeParserExecutor.executeParser(completeCode, codeGenTypeEnum);
    File file = CodeFileSaverExecutor.saveCode(multiFileCodeResult, codeGenTypeEnum, appId, version);
    
    long endTime = System.currentTimeMillis();
    log.info("文件保存完成，appId: {}, 耗时: {}ms", appId, endTime - startTime);
});
```

#### 原因 2：AI 模型调用还在进行

**问题流程：**
1. 旧请求的 AI 模型调用可能还在进行
2. 即使前端断开，AI 模型也会继续返回数据
3. 新请求可能需要等待 AI 模型资源释放

**验证方法：**
- 查看 AI 服务的日志
- 观察是否有多个请求同时调用 AI 模型

#### 原因 3：代码解析操作阻塞

**问题流程：**
1. `CodeParserExecutor.executeParser` 可能很耗时
2. 如果解析操作是同步的，会阻塞线程
3. 新请求可能需要等待解析完成

---

## 五、解决方案建议（仅分析，不修改代码）

### 方案 1：添加连接检测（推荐）

**在 Controller 层添加：**

```java
@GetMapping(value = "/chat/gen/code", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<String>> chatToGenCode(
    @RequestParam Long appId,
    @RequestParam String message,
    HttpServletRequest request,
    ServerHttpResponse response) {  // 添加 ServerHttpResponse 参数
    
    // 检测连接是否断开
    return contentFlux
        .takeUntil(chunk -> {
            // 检查响应是否已提交（连接可能已断开）
            return response.getStatusCode() != null;
        })
        .doOnCancel(() -> {
            log.info("客户端断开连接，取消 Flux，appId: {}", appId);
        })
        .map(chunk -> { ... });
}
```

### 方案 2：异步执行文件保存

**在 Facade 层修改：**

```java
private Flux<String> processCodeStream(Flux<String> codeStream, CodeGenTypeEnum codeGenTypeEnum, Long appId, int version) {
    StringBuilder codeBuilder = new StringBuilder();
    
    return codeStream
        .doOnNext(chunk -> {
            codeBuilder.append(chunk);
        })
        .doOnComplete(() -> {
            // 异步执行文件保存，不阻塞响应
            CompletableFuture.runAsync(() -> {
                try {
                    String completeCode = codeBuilder.toString();
                    Object multiFileCodeResult = CodeParserExecutor.executeParser(completeCode, codeGenTypeEnum);
                    File file = CodeFileSaverExecutor.saveCode(multiFileCodeResult, codeGenTypeEnum, appId, version);
                    log.info("保存成功,目录为:{}", file.getAbsolutePath());
                } catch(Exception e) {
                    log.error("保存代码失败", e);
                }
            });
        });
}
```

**优点：**
- 文件保存不会阻塞响应
- 即使前端断开，文件保存也会继续（这是合理的）

### 方案 3：添加请求去重机制

**在 Service 层添加：**

```java
// 使用 ConcurrentHashMap 存储正在处理的请求
private final Map<Long, Flux<String>> activeRequests = new ConcurrentHashMap<>();

@Override
public Flux<String> chatToGenCode(Long appId, String message, User loginUser) {
    // 如果同一应用有正在处理的请求，取消旧请求
    Flux<String> oldFlux = activeRequests.get(appId);
    if (oldFlux != null) {
        log.info("取消旧请求，appId: {}", appId);
        // 取消旧请求（注意：这需要 Flux 支持取消）
    }
    
    // 创建新请求
    Flux<String> newFlux = aiCodeGeneratorFacade.generateAndSaveCodeStream(...)
        .doOnTerminate(() -> {
            // 请求完成后移除
            activeRequests.remove(appId);
        });
    
    activeRequests.put(appId, newFlux);
    return newFlux;
}
```

**注意：**
- 这个方案需要 Flux 支持取消操作
- 可能需要使用 `Flux.switchOnNext` 或其他机制

### 方案 4：使用超时机制

**在 Controller 层添加：**

```java
return contentFlux
    .timeout(Duration.ofMinutes(5))  // 5 分钟超时
    .doOnError(TimeoutException.class, error -> {
        log.warn("请求超时，appId: {}", appId);
    })
    .map(chunk -> { ... });
```

---

## 六、验证方法

### 1. 添加详细日志

**在 Controller 层：**
```java
log.info("收到请求，appId: {}, message: {}", appId, message);
return contentFlux
    .doOnSubscribe(subscription -> log.info("Flux 订阅开始，appId: {}", appId))
    .doOnNext(chunk -> log.debug("发送数据块，appId: {}, 长度: {}", appId, chunk.length()))
    .doOnCancel(() -> log.info("Flux 被取消，appId: {}", appId))
    .doOnTerminate(() -> log.info("Flux 终止，appId: {}", appId))
    .doOnError(error -> log.error("Flux 错误，appId: {}", appId, error))
    .map(chunk -> { ... });
```

**在 Facade 层：**
```java
.doOnComplete(() -> {
    long startTime = System.currentTimeMillis();
    log.info("开始保存文件，appId: {}", appId);
    
    // ... 保存逻辑 ...
    
    long endTime = System.currentTimeMillis();
    log.info("文件保存完成，appId: {}, 耗时: {}ms", appId, endTime - startTime);
});
```

### 2. 测试场景

1. **发送消息，立即刷新：**
   - 观察旧请求的日志是否还在输出
   - 观察新请求是否立即开始处理

2. **发送消息，等待几秒后刷新：**
   - 观察文件保存操作是否还在执行
   - 观察新请求是否有延迟

3. **连续发送多个消息：**
   - 观察是否有并发限制
   - 观察是否有资源锁定

---

## 七、总结

### 问题根源

1. **没有连接检测机制** - Flux 不知道前端是否断开
2. **文件保存是同步的** - 可能阻塞新请求
3. **没有取消机制** - 无法中断正在处理的请求
4. **可能有资源锁定** - 文件保存可能锁定同一应用的文件

### 最可能的原因

**文件保存操作阻塞新请求** - 如果旧请求的 `doOnComplete` 正在执行文件保存，新请求可能需要等待文件保存完成。

### 建议

1. **添加连接检测** - 使用 `doOnCancel` 检测连接断开
2. **异步执行文件保存** - 使用 `CompletableFuture.runAsync` 异步保存文件
3. **添加详细日志** - 验证问题根源
4. **测试验证** - 通过日志确认问题

---

**文档版本：** 1.0  
**创建时间：** 2024年






