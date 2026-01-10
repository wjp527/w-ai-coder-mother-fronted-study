<template>
  <div id="appChatPage">
    <!-- 顶部栏 -->
    <div class="header-bar">
      <div class="header-left">
        <h1 class="app-name">{{ appInfo?.appName || '网站生成器' }}</h1>
        <a-tag v-if="appInfo?.codeGenType" color="blue" class="code-gen-type-tag">
          {{ formatCodeGenType(appInfo.codeGenType) }}
        </a-tag>
      </div>
      <div class="header-right">
        <a-button type="default" @click="showAppDetail">
          <template #icon>
            <InfoCircleOutlined />
          </template>
          应用详情
        </a-button>
        <a-button type="default" @click="exportAppCode" :loading="exporting">
          <template #icon>
            <DownloadOutlined />
          </template>
          导出代码
        </a-button>
        <a-button type="default" @click="downloadAppCode" :loading="downloading">
          <template #icon>
            <CodeOutlined />
          </template>
          下载代码
        </a-button>
        <a-button type="primary" @click="deployApp" :loading="deploying">
          <template #icon>
            <CloudUploadOutlined />
          </template>
          部署按钮
        </a-button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧对话区域 -->
      <div class="chat-section">
        <!-- 消息区域 -->
        <div class="messages-container" ref="messagesContainer">
          <!-- 加载更多按钮 -->
          <div v-if="hasMoreHistory" class="load-more-container">
            <a-button type="link" @click="loadMoreHistory" :loading="loadingHistory">
              加载更多历史消息
            </a-button>
          </div>
          <div v-for="(message, index) in messages" :key="message.id || index" class="message-item">
            <div v-if="message.type === 'user'" class="user-message">
              <div class="message-content">{{ message.content }}</div>
              <div class="message-avatar">
                <a-avatar :src="loginUserStore.loginUser.userAvatar" />
              </div>
            </div>
            <div v-else class="ai-message">
              <div class="message-avatar">
                <a-avatar :src="aiAvatar" />
              </div>
              <div class="message-content">
                <MarkdownRenderer v-if="message.content" :content="message.content" />
                <div v-if="message.loading" class="loading-indicator">
                  <a-spin size="small" />
                  <span>AI 正在思考...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 用户消息输入框 -->
        <div class="input-container">
          <!-- 选中元素信息提示 -->
          <div v-if="selectedElements.length > 0" class="selected-elements-alert">
            <a-alert
              v-for="(element, index) in selectedElements"
              :key="index"
              type="info"
              :message="formatElementInfo(element)"
              closable
              @close="removeSelectedElement(index)"
              style="margin-bottom: 8px"
            />
          </div>
          <!-- 附件列表组件 - 放在输入框上方 -->
          <div v-if="filesList && filesList.length > 0" class="attachments-list">
            <div
              v-for="(file, index) in filesList"
              :key="file.uid"
              class="attachment-item"
              :class="{ uploading: file.uploading }"
              @click="!file.uploading && handleFileClick(file)"
            >
              <PaperClipOutlined class="attachment-icon" />
              <span class="attachment-name">{{ file.name }}</span>
              <span class="attachment-size">{{ formatFileSize(file.size) }}</span>
              <div v-if="file.uploading" class="attachment-loading">
                <a-spin size="small" />
              </div>
              <a-button
                v-else
                type="text"
                size="small"
                danger
                @click.stop="removeFile(index)"
                class="attachment-delete-btn"
                :disabled="!isOwner"
              >
                <template #icon>
                  <DeleteOutlined />
                </template>
              </a-button>
            </div>
          </div>
          <div class="input-wrapper">
            <a-tooltip v-if="!isOwner" title="无法在别人的作品下对话哦~" placement="top">
              <a-textarea
                v-model:value="userInput"
                placeholder="请描述你想生成的网站，越详细效果越好哦"
                :rows="4"
                :maxlength="1000"
                @keydown.enter.prevent="sendMessage"
                :disabled="isGenerating || !isOwner"
              />
            </a-tooltip>
            <a-textarea
              v-else
              v-model:value="userInput"
              placeholder="请描述你想生成的网站，越详细效果越好哦"
              :rows="4"
              :maxlength="1000"
              @keydown.enter.prevent="sendMessage"
              :disabled="isGenerating"
            />
            <div class="input-actions">
              <a-upload
                :before-upload="handleFileUpload"
                :show-upload-list="false"
                :disabled="!isOwner || isGenerating"
                accept="*/*"
                multiple
              >
                <template #default>
                  <a-button
                    type="default"
                    :disabled="!isOwner || isGenerating"
                    style="margin-right: 8px"
                  >
                    <template #icon>
                      <UploadOutlined />
                    </template>
                    上传文件
                  </a-button>
                </template>
              </a-upload>
              <a-button
                type="primary"
                @click="sendMessage"
                :loading="isGenerating"
                :disabled="!isOwner"
              >
                <template #icon>
                  <SendOutlined />
                </template>
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧网页展示区域 -->
      <div class="preview-section">
        <div class="preview-header">
          <h3>生成后的网页展示</h3>
          <div class="preview-actions">
            <a-button
              :type="isEditMode ? 'default' : 'default'"
              :danger="isEditMode"
              @click="toggleEditMode"
              :disabled="!isOwner || !previewUrl || isGenerating"
              style="margin-right: 8px"
            >
              <template #icon>
                <EditOutlined />
              </template>
              {{ isEditMode ? '退出编辑' : '编辑模式' }}
            </a-button>
            <a-button v-if="previewUrl" type="link" @click="openInNewTab">
              <template #icon>
                <ExportOutlined />
              </template>
              新窗口打开
            </a-button>
          </div>
        </div>
        <div class="preview-content">
          <div v-if="!previewUrl && !isGenerating" class="preview-placeholder">
            <div class="placeholder-icon">🌐</div>
            <p>网站文件生成完成后将在这里展示</p>
          </div>
          <div v-else-if="isGenerating" class="preview-loading">
            <a-spin size="large" />
            <p>正在生成网站...</p>
          </div>
          <iframe
            v-else
            ref="previewIframe"
            :src="previewUrl"
            class="preview-iframe"
            frameborder="0"
            @load="onIframeLoad"
          ></iframe>
        </div>
      </div>
    </div>

    <!-- 应用详情弹窗 -->
    <AppDetailModal
      v-model:open="appDetailVisible"
      :app="appInfo"
      :show-actions="isOwner || isAdmin"
      @edit="editApp"
      @delete="deleteApp"
    />

    <!-- 部署成功弹窗 -->
    <DeploySuccessModal
      v-model:open="deployModalVisible"
      :deploy-url="deployUrl"
      @open-site="openDeployedSite"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useLoginUserStore } from '@/stores/loginUser'
import {
  getAppVoById,
  deployApp as deployAppApi,
  deleteApp as deleteAppApi,
} from '@/api/appController'
import { listAppChatHistory } from '@/api/chatHistoryController'
import { upload as uploadFile } from '@/api/fileController'
import { CodeGenTypeEnum, formatCodeGenType } from '@/utils/codeGenTypes'
import request from '@/request'

import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import AppDetailModal from '@/components/AppDetailModal.vue'
import DeploySuccessModal from '@/components/DeploySuccessModal.vue'
import aiAvatar from '@/assets/aiAvatar.png'
import { API_BASE_URL, getStaticPreviewUrl } from '@/config/env'
import {
  injectVisualEditorScript,
  clearSelection,
  formatElementsToPrompt,
  type SelectedElement,
} from '@/utils/visualEditor'

import {
  CloudUploadOutlined,
  SendOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  CodeOutlined,
  EditOutlined,
  PaperClipOutlined,
  UploadOutlined,
  DeleteOutlined,
  ExportOutlined,
} from '@ant-design/icons-vue'

// #region agent log
interface FileItem {
  uid: string
  name: string
  size: number
  url?: string
  description?: string
  status?: string
  percent?: string
  uploading?: boolean
}

const logDebug = (message: string, data?: Record<string, unknown>) => {
  fetch('http://127.0.0.1:7242/ingest/713692ac-a0ce-4baa-97ba-ca9e731e001c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'AppChatPage.vue:224',
      message,
      data: data || {},
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    }),
  }).catch(() => {})
}
// #endregion

const filesList = ref<FileItem[]>([])

const handleFileClick = (file: FileItem) => {
  // #region agent log
  logDebug('File clicked', { file, eventType: typeof file })
  // #endregion
  console.log('fileClick', file)
  // 如果文件有 URL，在新窗口打开
  if (file.url) {
    window.open(file.url, '_blank')
  }
}

// 处理文件上传
const handleFileUpload = async (file: File): Promise<boolean> => {
  if (!isOwner.value) {
    message.warning('无法在别人的作品下上传文件哦~')
    return false
  }

  // 立即添加到文件列表，并标记为上传中
  const fileUid = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const fileItem: FileItem = {
    uid: fileUid,
    name: file.name,
    size: file.size,
    uploading: true,
  }

  filesList.value.push(fileItem)

  try {
    // 调用上传接口
    const res = await uploadFile(file)

    if (res.data.code === 0 && res.data.data) {
      const { url, filename } = res.data.data

      // 根据 uid 查找并更新文件项
      const fileIndex = filesList.value.findIndex((f) => f.uid === fileUid)
      if (fileIndex !== -1) {
        filesList.value[fileIndex] = {
          ...filesList.value[fileIndex],
          name: filename || file.name,
          url: url,
          uploading: false,
        }
      }

      message.success('文件上传成功')

      // #region agent log
      logDebug('File uploaded successfully', {
        fileItem: filesList.value[fileIndex],
        url,
        filename,
      })
      // #endregion
    } else {
      // 上传失败，移除文件项
      const fileIndex = filesList.value.findIndex((f) => f.uid === fileUid)
      if (fileIndex !== -1) {
        filesList.value.splice(fileIndex, 1)
      }
      message.error('上传失败：' + (res.data.message || '未知错误'))
      return false
    }
  } catch (error) {
    console.error('文件上传失败：', error)
    // 上传失败，移除文件项
    const fileIndex = filesList.value.findIndex((f) => f.uid === fileUid)
    if (fileIndex !== -1) {
      filesList.value.splice(fileIndex, 1)
    }
    message.error('文件上传失败，请重试')
    return false
  }

  // 阻止默认上传行为，因为我们自己处理
  return false
}

// 移除文件
const removeFile = (index: number) => {
  if (!isOwner.value) {
    message.warning('无法在别人的作品下删除文件哦~')
    return
  }
  filesList.value.splice(index, 1)
  message.success('文件已移除')
}

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

// 应用信息
const appInfo = ref<API.AppVO>()
const appId = ref<string>()

// 对话相关
interface Message {
  id?: number
  type: 'user' | 'ai'
  content: string
  loading?: boolean
  createTime?: string
}

const messages = ref<Message[]>([])
const userInput = ref('')
const isGenerating = ref(false)
const messagesContainer = ref<HTMLElement>()
const hasInitialConversation = ref(false) // 标记是否已经进行过初始对话

// 对话历史相关
const loadingHistory = ref(false)
const hasMoreHistory = ref(false)
const lastCreateTime = ref<string | undefined>(undefined) // 用于游标分页

// 预览相关
const previewUrl = ref('')
const previewReady = ref(false)
const previewIframe = ref<HTMLIFrameElement>()

// 编辑模式相关
const isEditMode = ref(false)
const selectedElements = ref<SelectedElement[]>([])
let cleanupVisualEditor: (() => void) | null = null

// 部署相关
const deploying = ref(false)
const deployModalVisible = ref(false)
const deployUrl = ref('')

// 导出相关
const exporting = ref(false)

// 下载相关
const downloading = ref(false)

// 权限相关
const isOwner = computed(() => {
  return appInfo.value?.userId === loginUserStore.loginUser.id
})

const isAdmin = computed(() => {
  return loginUserStore.loginUser.userRole === 'admin'
})

// 应用详情相关
const appDetailVisible = ref(false)

// 显示应用详情
const showAppDetail = () => {
  appDetailVisible.value = true
}

// 加载对话历史
const loadChatHistory = async (cursor?: string, isLoadMore = false) => {
  if (!appId.value || loadingHistory.value) return

  loadingHistory.value = true
  try {
    const res = await listAppChatHistory({
      appId: appId.value as unknown as number,
      pageSize: 10,
      lastCreateTime: cursor,
    })

    if (res.data.code === 0 && res.data.data) {
      const records = res.data.data.records || []

      // 将历史消息转换为Message格式，并按创建时间升序排序（老消息在前，新消息在后）
      const historyMessages: Message[] = records
        .map((item: API.ChatHistory) => ({
          id: item.id,
          type: item.messageType === 'user' ? 'user' : 'ai',
          content: item.message || '',
          createTime: item.createTime,
        }))
        .sort((a, b) => {
          if (!a.createTime || !b.createTime) return 0
          return new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
        })

      if (isLoadMore && cursor) {
        // 加载更多：将更老的消息插入到现有消息前面（上方）
        messages.value = [...historyMessages, ...messages.value]
      } else {
        // 首次加载或重新加载：直接设置消息列表（已按时间升序，老的在前面）
        messages.value = historyMessages
      }

      // 判断是否还有更多历史消息
      // 如果返回的记录数等于pageSize，说明可能还有更多
      hasMoreHistory.value = records.length === 10

      // 更新游标（取最早一条消息的创建时间，用于下次加载更早的消息）
      if (historyMessages.length > 0) {
        const earliestMessage = historyMessages[0]
        lastCreateTime.value = earliestMessage.createTime
      }

      // 如果有历史消息且至少2条，更新预览
      if (messages.value.length >= 2 && !isLoadMore) {
        await nextTick()
        updatePreview()
      }
    }
  } catch (error) {
    console.error('加载对话历史失败：', error)
    message.error('加载对话历史失败')
  } finally {
    loadingHistory.value = false
  }
}

// 加载更多历史消息
const loadMoreHistory = async () => {
  // 保存当前滚动位置
  const oldScrollHeight = messagesContainer.value?.scrollHeight || 0
  await loadChatHistory(lastCreateTime.value, true)
  await nextTick()
  // 恢复到加载更多按钮的位置（保持滚动位置）
  if (messagesContainer.value) {
    const newScrollHeight = messagesContainer.value.scrollHeight
    const scrollDiff = newScrollHeight - oldScrollHeight
    messagesContainer.value.scrollTop = scrollDiff
  }
}

// 获取应用信息
const fetchAppInfo = async () => {
  const id = route.params.id as string
  if (!id) {
    message.error('应用ID不存在')
    router.push('/')
    return
  }

  appId.value = id

  try {
    const res = await getAppVoById({ id: id as unknown as number })
    if (res.data.code === 0 && res.data.data) {
      appInfo.value = res.data.data

      // 先加载对话历史
      await loadChatHistory()

      // 判断是否自动发送初始提示词
      // 只有在是自己的app且没有对话历史时才自动发送
      const hasHistory = messages.value.length > 0
      if (
        appInfo.value.initPrompt &&
        isOwner.value &&
        !hasHistory &&
        !hasInitialConversation.value
      ) {
        hasInitialConversation.value = true
        await sendInitialMessage(appInfo.value.initPrompt)
      }
    } else {
      message.error('获取应用信息失败')
      router.push('/')
    }
  } catch (error) {
    console.error('获取应用信息失败：', error)
    message.error('获取应用信息失败')
    router.push('/')
  }
}

// 发送初始消息
const sendInitialMessage = async (prompt: string) => {
  // 添加用户消息
  messages.value.push({
    type: 'user',
    content: prompt,
  })

  // 添加AI消息占位符
  const aiMessageIndex = messages.value.length
  messages.value.push({
    type: 'ai',
    content: '',
    loading: true,
    createTime: new Date().toISOString(),
  })

  await nextTick()
  scrollToBottom()

  // 开始生成
  isGenerating.value = true
  await generateCode(prompt, aiMessageIndex)
}

// 发送消息
const sendMessage = async () => {
  // 如果输入框为空且没有附件，则不发送
  if ((!userInput.value.trim() && filesList.value.length === 0) || isGenerating.value) {
    return
  }

  // 保存原始用户输入
  const originalUserInput = userInput.value.trim()

  // 构建完整的消息（包含元素信息）
  let fullMessage = originalUserInput

  // 如果有选中的元素，将元素信息添加到提示词中
  if (selectedElements.value.length > 0) {
    fullMessage += formatElementsToPrompt(selectedElements.value)
  }

  // 如果有附件，将附件信息添加到提示词中
  if (filesList.value.length > 0) {
    const fileInfo = filesList.value
      .map((file) => {
        let info = `文件: ${file.name}`
        if (file.url) {
          info += ` (URL: ${file.url})`
        }
        if (file.size) {
          info += ` (大小: ${formatFileSize(file.size)})`
        }
        return info
      })
      .join('\n')
    fullMessage += `\n\n附件信息:\n${fileInfo}`
  }

  // 清空输入框
  userInput.value = ''

  // 清除选中元素并退出编辑模式
  clearSelectedElements()
  exitEditMode()

  // 添加用户消息（显示原始输入和附件信息，不包含元素信息）
  let displayContent = originalUserInput
  if (filesList.value.length > 0) {
    displayContent += `\n[附件: ${filesList.value.map((f) => f.name).join(', ')}]`
  }

  messages.value.push({
    type: 'user',
    content: displayContent,
    createTime: new Date().toISOString(),
  })

  // 发送消息后清空文件列表
  filesList.value = []

  // 添加AI消息占位符
  const aiMessageIndex = messages.value.length
  messages.value.push({
    type: 'ai',
    content: '',
    loading: true,
    createTime: new Date().toISOString(),
  })

  await nextTick()
  scrollToBottom()

  // 开始生成（使用包含元素信息的完整消息）
  isGenerating.value = true
  await generateCode(fullMessage, aiMessageIndex)
}

// 生成代码 - 使用 EventSource 处理流式响应
const generateCode = async (userMessage: string, aiMessageIndex: number) => {
  let eventSource: EventSource | null = null
  let streamCompleted = false

  try {
    // 获取 axios 配置的 baseURL
    const baseURL = request.defaults.baseURL || API_BASE_URL

    // 构建URL参数
    const params = new URLSearchParams({
      appId: appId.value || '',
      message: userMessage,
    })

    console.log(params, 'params')
    const url = `${baseURL}/app/chat/gen/code?${params}`
    console.log(url, 'url')
    // 创建 EventSource 连接
    eventSource = new EventSource(url, {
      withCredentials: true, // 是否发送凭证（Cookie）
    })

    let fullContent = ''

    // 处理接收到的消息
    /**
     * SSE事件处理函数
     * @param event 事件对象
     * @param event.data 事件数据【后端返回的数据，最终要在前端展示出来的】
     */
    eventSource.onmessage = function (event) {
      if (streamCompleted) return

      try {
        // 解析JSON包装的数据
        const parsed = JSON.parse(event.data)
        // 把字符串提取出来
        const content = parsed.d

        // 拼接内容
        if (content !== undefined && content !== null) {
          // 拼接内容
          fullContent += content
          // 更新消息内容
          messages.value[aiMessageIndex].content = fullContent
          // 更新消息状态
          messages.value[aiMessageIndex].loading = false
          console.log(messages.value, 'messages.value')
          // 滚动到底部
          scrollToBottom()
        }
      } catch (error) {
        console.error('解析消息失败:', error)
        handleError(error, aiMessageIndex)
      }
    }

    // 处理done事件
    eventSource.addEventListener('done', function () {
      if (streamCompleted) return

      streamCompleted = true
      isGenerating.value = false
      eventSource?.close()

      // 延迟更新预览和重新加载历史，确保后端已完成处理
      setTimeout(async () => {
        await fetchAppInfo()
        updatePreview()
        // 重新加载最新的对话历史以同步数据
        await loadChatHistory()
        await nextTick()
        scrollToBottom()
      }, 1000)
    })

    // 处理错误
    eventSource.onerror = function () {
      if (streamCompleted || !isGenerating.value) return
      // 检查是否是正常的连接关闭
      if (eventSource?.readyState === EventSource.CONNECTING) {
        streamCompleted = true
        isGenerating.value = false
        eventSource?.close()

        setTimeout(async () => {
          await fetchAppInfo()
          updatePreview()
          // 重新加载最新的对话历史以同步数据
          await loadChatHistory()
          await nextTick()
          scrollToBottom()
        }, 1000)
      } else {
        handleError(new Error('SSE连接错误'), aiMessageIndex)
      }
    }
  } catch (error) {
    console.error('创建 EventSource 失败：', error)
    handleError(error, aiMessageIndex)
  }
}

// 错误处理函数
const handleError = (error: unknown, aiMessageIndex: number) => {
  console.error('生成代码失败：', error)
  messages.value[aiMessageIndex].content = '抱歉，生成过程中出现了错误，请重试。'
  messages.value[aiMessageIndex].loading = false
  message.error('生成失败，请重试')
  isGenerating.value = false
}

// 更新预览
const buildPreviewUrl = () => {
  if (!appId.value) {
    return ''
  }
  const codeGenType = appInfo.value?.codeGenType || CodeGenTypeEnum.HTML
  const baseUrl = getStaticPreviewUrl(codeGenType, appId.value)
  const version = Date.now()
  const separator = baseUrl.includes('?') ? '&' : '?'
  console.log('预览链接: ', `${baseUrl}${separator}t=${version}`)
  return `${baseUrl}${separator}t=${version}`
}

// 更新预览
const updatePreview = () => {
  // 如果app有至少2条对话记录，也展示对应的网站
  if (appId.value && messages.value.length >= 2) {
    previewUrl.value = buildPreviewUrl()
    previewReady.value = true
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 部署应用
const deployApp = async () => {
  if (!appId.value) {
    message.error('应用ID不存在')
    return
  }

  deploying.value = true
  try {
    const res = await deployAppApi({
      appId: appId.value as unknown as number,
      version: 1,
    })

    if (res.data.code === 0 && res.data.data) {
      deployUrl.value = res.data.data
      deployModalVisible.value = true
      message.success('部署成功')
    } else {
      message.error('部署失败：' + res.data.message)
    }
  } catch (error) {
    console.error('部署失败：', error)
    message.error('部署失败，请重试')
  } finally {
    deploying.value = false
  }
}

// 导出应用代码
const exportAppCode = async () => {
  if (!appId.value) {
    message.error('应用ID不存在')
    return
  }

  exporting.value = true
  try {
    // 使用 blob 方式下载文件
    const baseURL = request.defaults.baseURL || API_BASE_URL
    const url = `${baseURL}/app/export/code/${appId.value}`

    const response = await request({
      url,
      method: 'GET',
      responseType: 'blob',
      withCredentials: true,
    })

    // 从响应头中获取文件名
    const contentDisposition = response.headers['content-disposition']
    let fileName = `${appInfo.value?.appName || 'app'}.md`

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1].replace(/['"]/g, '')
        // 处理可能的 UTF-8 编码文件名
        if (fileName.startsWith("UTF-8''")) {
          fileName = decodeURIComponent(fileName.replace(/UTF-8''/, ''))
        }
      }
    }

    // 创建 blob 对象
    const blob = new Blob([response.data], { type: 'text/markdown' })

    // 创建下载链接
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()

    // 清理
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)

    message.success('导出成功')
  } catch (error) {
    console.error('导出失败：', error)

    // 尝试解析错误响应（可能是 JSON 格式的错误信息）
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: Blob } }
      if (axiosError.response?.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text()
          const errorData = JSON.parse(text) as { message?: string }
          message.error('导出失败：' + (errorData.message || '未知错误'))
        } catch {
          message.error('导出失败，请重试')
        }
      } else {
        message.error('导出失败，请重试')
      }
    } else {
      message.error('导出失败，请重试')
    }
  } finally {
    exporting.value = false
  }
}

// 下载应用代码
const downloadAppCode = async () => {
  if (!appId.value) {
    message.error('应用ID不存在')
    return
  }

  downloading.value = true
  try {
    // 使用 blob 方式下载文件
    const baseURL = request.defaults.baseURL || API_BASE_URL
    const url = `${baseURL}/app/download/${appId.value}`

    const response = await request({
      url,
      method: 'GET',
      responseType: 'blob',
      withCredentials: true,
    })

    // 从响应头中获取文件名
    const contentDisposition = response.headers.get('Content-Disposition')
    const fileName = contentDisposition?.match(/filename="(.+)"/)?.[1] || `app-${appId.value}.zip`
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1].replace(/['"]/g, '')
        // 处理可能的 UTF-8 编码文件名
        if (fileName.startsWith("UTF-8''")) {
          fileName = decodeURIComponent(fileName.replace(/UTF-8''/, ''))
        }
      }
    }

    // 创建 blob 对象
    const blob = new Blob([response.data], { type: 'application/zip' })

    // 创建下载链接
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()

    // 清理
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)

    message.success('下载成功')
  } catch (error) {
    console.error('下载失败：', error)

    // 尝试解析错误响应（可能是 JSON 格式的错误信息）
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: Blob } }
      if (axiosError.response?.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text()
          const errorData = JSON.parse(text) as { message?: string }
          message.error('下载失败：' + (errorData.message || '未知错误'))
        } catch {
          message.error('下载失败，请重试')
        }
      } else {
        message.error('下载失败，请重试')
      }
    } else {
      message.error('下载失败，请重试')
    }
  } finally {
    downloading.value = false
  }
}

// 在新窗口打开预览
const openInNewTab = () => {
  if (previewUrl.value) {
    window.open(previewUrl.value, '_blank')
  }
}

// 打开部署的网站
const openDeployedSite = () => {
  if (deployUrl.value) {
    window.open(deployUrl.value, '_blank')
  }
}

// iframe加载完成
const onIframeLoad = () => {
  previewReady.value = true
  // 如果处于编辑模式，重新注入脚本
  if (isEditMode.value && previewIframe.value) {
    enterEditMode()
  }
}

// 切换编辑模式
const toggleEditMode = () => {
  if (isEditMode.value) {
    exitEditMode()
  } else {
    enterEditMode()
  }
}

// 进入编辑模式
const enterEditMode = () => {
  if (!previewIframe.value || !previewUrl.value) {
    message.warning('预览页面未加载完成')
    return
  }

  // 清除之前的清理函数
  if (cleanupVisualEditor) {
    cleanupVisualEditor()
    cleanupVisualEditor = null
  }

  isEditMode.value = true

  // 等待 iframe 内容完全加载
  nextTick(() => {
    if (!previewIframe.value) return

    try {
      // 检查 iframe 是否可访问（同域）
      const iframeDoc =
        previewIframe.value.contentDocument || previewIframe.value.contentWindow?.document
      if (!iframeDoc) {
        message.error('无法访问预览页面，请确保预览页面与主网站同域')
        isEditMode.value = false
        return
      }

      // 注入可视化编辑脚本
      cleanupVisualEditor = injectVisualEditorScript(previewIframe.value, handleElementSelected)
    } catch (error) {
      console.error('进入编辑模式失败:', error)
      message.error('进入编辑模式失败，请确保预览页面与主网站同域')
      isEditMode.value = false
    }
  })
}

// 退出编辑模式
const exitEditMode = () => {
  isEditMode.value = false

  // 执行清理函数
  if (cleanupVisualEditor) {
    cleanupVisualEditor()
    cleanupVisualEditor = null
  }

  // 清除 iframe 中的选中状态
  if (previewIframe.value) {
    clearSelection(previewIframe.value)
  }
}

// 处理元素选择
const handleElementSelected = (element: SelectedElement) => {
  // 检查是否已存在相同的元素（通过选择器判断）
  const exists = selectedElements.value.some(
    (el) => el.selector === element.selector && el.id === element.id,
  )

  if (!exists) {
    selectedElements.value.push(element)
  }
}

// 移除选中的元素
const removeSelectedElement = (index: number) => {
  selectedElements.value.splice(index, 1)
}

// 清除所有选中的元素
const clearSelectedElements = () => {
  selectedElements.value = []
}

// 格式化元素信息显示
const formatElementInfo = (element: SelectedElement): string => {
  let info = `标签: ${element.tagName}`
  if (element.id) {
    info += `, ID: ${element.id}`
  }
  if (element.className) {
    info += `, 类名: ${element.className.split(' ').slice(0, 2).join(' ')}${element.className.split(' ').length > 2 ? '...' : ''}`
  }
  if (element.textContent) {
    const text = element.textContent.substring(0, 30)
    info += `, 文本: ${text}${element.textContent.length > 30 ? '...' : ''}`
  }
  return info
}

// 编辑应用
const editApp = () => {
  if (appInfo.value?.id) {
    router.push(`/app/edit/${appInfo.value.id}`)
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// 删除应用
const deleteApp = async () => {
  if (!appInfo.value?.id) return

  try {
    const res = await deleteAppApi({ id: appInfo.value.id })
    if (res.data.code === 0) {
      message.success('删除成功')
      appDetailVisible.value = false
      router.push('/')
    } else {
      message.error('删除失败：' + res.data.message)
    }
  } catch (error) {
    console.error('删除失败：', error)
    message.error('删除失败')
  }
}

// 页面加载时获取应用信息
onMounted(() => {
  // #region agent log
  logDebug('Component mounted, filesList length', {
    length: filesList.value.length,
    filesList: filesList.value,
  })
  nextTick(() => {
    const attachmentsEl = document.querySelector('.attachments-list') as HTMLElement
    if (attachmentsEl) {
      const computedStyle = window.getComputedStyle(attachmentsEl)
      const rect = attachmentsEl.getBoundingClientRect()
      logDebug('Attachments element detailed check', {
        exists: true,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        height: attachmentsEl.offsetHeight,
        width: attachmentsEl.offsetWidth,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
        zIndex: computedStyle.zIndex,
        backgroundColor: computedStyle.backgroundColor,
        overflow: computedStyle.overflow,
        maxHeight: computedStyle.maxHeight,
        items: attachmentsEl.querySelectorAll('.attachment-item').length,
        parent: attachmentsEl.parentElement?.className || 'no parent',
        scrollHeight: attachmentsEl.scrollHeight,
        clientHeight: attachmentsEl.clientHeight,
        viewportHeight: window.innerHeight,
        isInViewport:
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth,
      })

      // 检查第一个附件项
      const firstItem = attachmentsEl.querySelector('.attachment-item') as HTMLElement
      if (firstItem) {
        const itemStyle = window.getComputedStyle(firstItem)
        const itemRect = firstItem.getBoundingClientRect()
        logDebug('First attachment item check', {
          exists: true,
          display: itemStyle.display,
          visibility: itemStyle.visibility,
          opacity: itemStyle.opacity,
          height: firstItem.offsetHeight,
          width: firstItem.offsetWidth,
          top: itemRect.top,
          left: itemRect.left,
          backgroundColor: itemStyle.backgroundColor,
          color: itemStyle.color,
          textContent: firstItem.textContent?.substring(0, 50),
        })
      }
    } else {
      logDebug('Attachments element not found in DOM', {})
    }
  })
  // #endregion
  fetchAppInfo()
})

// 清理资源
onUnmounted(() => {
  // EventSource 会在组件卸载时自动清理
  // 清理可视化编辑器
  if (cleanupVisualEditor) {
    cleanupVisualEditor()
    cleanupVisualEditor = null
  }
})
</script>

<style scoped>
#appChatPage {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #fdfdfd;
}

/* 顶部栏 */
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.header-right {
  display: flex;
  gap: 12px;
}

/* 主要内容区域 */
.main-content {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 8px;
  overflow: hidden;
}

/* 左侧对话区域 */
.chat-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.messages-container {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 12px 0;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 12px;
}

.message-item {
  margin-bottom: 12px;
}

.user-message {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 8px;
}

.ai-message {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 8px;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}

.user-message .message-content {
  background: #1890ff;
  color: white;
}

.ai-message .message-content {
  background: #f5f5f5;
  color: #1a1a1a;
  padding: 8px 12px;
}

.message-avatar {
  flex-shrink: 0;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
}

/* 输入区域 */
.input-container {
  padding: 16px;
  background: white;
}

.selected-elements-alert {
  margin-bottom: 12px;
}

/* 附件列表样式 */
.attachments-list {
  margin-bottom: 12px;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  min-height: 60px;
}

.attachments-list::-webkit-scrollbar {
  width: 6px;
}

.attachments-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.attachments-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.attachments-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.attachment-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 6px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.attachment-item:hover {
  background: #e6f7ff;
  border-color: #1890ff;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.15);
  transform: translateY(-1px);
}

.attachment-item:hover .attachment-delete-btn {
  opacity: 1;
}

.attachment-delete-btn {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.attachment-item:last-child {
  margin-bottom: 0;
}

.attachment-icon {
  margin-right: 8px;
  color: #1890ff;
}

.attachment-name {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.attachment-loading {
  margin-left: 8px;
  display: flex;
  align-items: center;
  color: #1890ff;
}

.attachment-item.uploading {
  cursor: default;
  opacity: 0.8;
}

.attachment-item.uploading:hover {
  background: #ffffff;
  border-color: #e8e8e8;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transform: none;
}

.input-wrapper {
  position: relative;
}

.input-wrapper .ant-input {
  padding-right: 50px;
}

.input-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
}

/* 右侧预览区域 */
.preview-section {
  flex: 3;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.preview-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.preview-loading p {
  margin-top: 16px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }

  .chat-section,
  .preview-section {
    flex: none;
    height: 50vh;
  }
}

@media (max-width: 768px) {
  .header-bar {
    padding: 12px 16px;
  }

  .app-name {
    font-size: 16px;
  }

  .main-content {
    padding: 8px;
    gap: 8px;
  }

  .message-content {
    max-width: 85%;
  }
}
</style>
