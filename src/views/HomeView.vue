<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useLoginUserStore } from '@/stores/loginUser'
import { addApp, listMyAppVoByPage, listGoodAppVoByPage } from '@/api/appController'
import { getDeployUrl } from '@/config/env'
import AppCard from '@/components/AppCard.vue'
import { PaperClipOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'

const router = useRouter()
const loginUserStore = useLoginUserStore()

// 用户提示词
const userPrompt = ref('')
const creating = ref(false)

// 我的应用数据
const myApps = ref<API.AppVO[]>([])
const myAppsPage = reactive({
  current: 1,
  pageSize: 6,
  total: 0,
})

// 精选应用数据
const featuredApps = ref<API.AppVO[]>([])
const featuredAppsPage = reactive({
  current: 1,
  pageSize: 6,
  total: 0,
})

// 设置提示词
const setPrompt = (prompt: string) => {
  userPrompt.value = prompt
}

// 优化提示词
const optimizePrompt = () => {
  if (!userPrompt.value.trim()) {
    message.warning('请先输入应用描述')
    return
  }
  // TODO: 实现提示词优化功能
  message.info('提示词优化功能开发中...')
}

// 上传文件
const handleUpload = () => {
  // TODO: 实现文件上传功能
  message.info('文件上传功能开发中...')
}

// 创建应用
const createApp = async () => {
  if (!userPrompt.value.trim()) {
    message.warning('请输入应用描述')
    return
  }

  if (!loginUserStore.loginUser.id) {
    message.warning('请先登录')
    await router.push('/user/login')
    return
  }

  creating.value = true
  try {
    const res = await addApp({
      initPrompt: userPrompt.value.trim(),
    })

    if (res.data.code === 0 && res.data.data) {
      message.success('应用创建成功')
      // 跳转到对话页面，确保ID是字符串类型
      const appId = String(res.data.data)
      await router.push(`/app/chat/${appId}`)
    } else {
      message.error('创建失败：' + res.data.message)
    }
  } catch (error) {
    console.error('创建应用失败：', error)
    message.error('创建失败，请重试')
  } finally {
    creating.value = false
  }
}

// 加载我的应用
const loadMyApps = async () => {
  if (!loginUserStore.loginUser.id) {
    return
  }

  try {
    const res = await listMyAppVoByPage({
      pageNum: myAppsPage.current,
      pageSize: myAppsPage.pageSize,
      sortField: 'createTime',
      sortOrder: 'desc',
    })

    if (res.data.code === 0 && res.data.data) {
      myApps.value = res.data.data.records || []
      myAppsPage.total = res.data.data.totalRow || 0
    }
  } catch (error) {
    console.error('加载我的应用失败：', error)
  }
}

// 加载精选应用
const loadFeaturedApps = async () => {
  try {
    const res = await listGoodAppVoByPage({
      pageNum: featuredAppsPage.current,
      pageSize: featuredAppsPage.pageSize,
      sortField: 'createTime',
      sortOrder: 'desc',
    })

    if (res.data.code === 0 && res.data.data) {
      featuredApps.value = res.data.data.records || []
      featuredAppsPage.total = res.data.data.totalRow || 0
    }
  } catch (error) {
    console.error('加载精选应用失败：', error)
  }
}

// 查看对话
const viewChat = (appId: string | number | undefined) => {
  if (appId) {
    router.push(`/app/chat/${appId}?view=1`)
  }
}

// 查看作品
const viewWork = (app: API.AppVO) => {
  if (app.deployKey) {
    const url = getDeployUrl(app.deployKey)
    window.open(url, '_blank')
  }
}

// 格式化时间函数已移除，不再需要显示创建时间

// 页面加载时获取数据
onMounted(() => {
  loadMyApps()
  loadFeaturedApps()

  // 鼠标跟随光效
  const handleMouseMove = (e: MouseEvent) => {
    const { clientX, clientY } = e
    const { innerWidth, innerHeight } = window
    const x = (clientX / innerWidth) * 100
    const y = (clientY / innerHeight) * 100

    document.documentElement.style.setProperty('--mouse-x', `${x}%`)
    document.documentElement.style.setProperty('--mouse-y', `${y}%`)
  }

  document.addEventListener('mousemove', handleMouseMove)

  // 清理事件监听器
  return () => {
    document.removeEventListener('mousemove', handleMouseMove)
  }
})
</script>

<template>
  <div id="homePage">
    <div class="container">
      <!-- 网站标题和描述 -->
      <div class="hero-section">
        <h1 class="hero-title">
          <span>一句话</span>
          <span class="cat-icon">🐱</span>
          <span>呈所想</span>
        </h1>
        <p class="hero-description">与 AI 对话轻松创建应用和网站</p>
      </div>

      <!-- 用户提示词输入框 -->
      <div class="input-section">
        <div class="input-panel">
          <a-textarea
            v-model:value="userPrompt"
            placeholder="使用 NoCode 创建一个高效的小工具,帮我计算......."
            :rows="4"
            :maxlength="1000"
            class="prompt-input"
            :bordered="false"
          />
          <div class="input-footer">
            <div class="input-left-actions">
              <a-button type="text" size="small" @click="handleUpload" class="action-btn">
                <template #icon>
                  <PaperClipOutlined />
                </template>
                上传
              </a-button>
              <a-button type="text" size="small" @click="optimizePrompt" class="action-btn">
                <template #icon>
                  <ThunderboltOutlined />
                </template>
                优化
              </a-button>
            </div>
            <div class="input-right-actions">
              <a-button
                type="primary"
                shape="circle"
                size="large"
                @click="createApp"
                :loading="creating"
                :disabled="!userPrompt.trim()"
                class="send-button"
              >
                <template #icon>
                  <span class="send-icon">↑</span>
                </template>
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷按钮 -->
      <div class="quick-actions">
        <a-button
          type="default"
          class="quick-action-btn"
          @click="
            setPrompt(
              '创建一个波普风格的电商页面，采用鲜艳的色彩搭配和几何图形设计，包含商品展示、购物车、用户登录等功能。',
            )
          "
          >波普风电商页面</a-button
        >
        <a-button
          type="default"
          class="quick-action-btn"
          @click="
            setPrompt(
              '设计一个专业的企业网站，包含公司介绍、产品服务展示、新闻资讯、联系我们等页面。采用商务风格的设计，包含轮播图、产品展示卡片、团队介绍、客户案例展示。',
            )
          "
          >企业网站</a-button
        >
        <a-button
          type="default"
          class="quick-action-btn"
          @click="
            setPrompt(
              '构建一个电商运营后台管理系统，包含商品管理、订单管理、用户管理、数据统计、营销活动等功能模块。采用现代化的后台管理界面设计。',
            )
          "
          >电商运营后台</a-button
        >
        <a-button
          type="default"
          class="quick-action-btn"
          @click="
            setPrompt(
              '创建一个暗黑风格的话题社区，包含话题发布、评论互动、用户关注、内容推荐等功能。采用深色主题设计，支持夜间模式。',
            )
          "
          >暗黑话题社区</a-button
        >
      </div>

      <!-- 我的作品 -->
      <div class="section" v-if="loginUserStore.loginUser.id">
        <h2 class="section-title">我的作品</h2>
        <div class="app-grid" v-if="myApps.length > 0">
          <AppCard
            v-for="app in myApps"
            :key="app.id"
            :app="app"
            @view-chat="viewChat"
            @view-work="viewWork"
          />
        </div>
        <div class="empty-state" v-else>
          <div class="empty-card">
            <div class="empty-preview">
              <div class="empty-placeholder">🐱</div>
            </div>
            <div class="empty-info">
              <div class="empty-line"></div>
              <div class="empty-line short"></div>
              <div class="empty-line shorter"></div>
            </div>
          </div>
          <p class="empty-text">还没有创建应用，试试在上方输入框创建你的第一个应用吧！</p>
        </div>
        <div class="pagination-wrapper" v-if="myAppsPage.total > 0">
          <a-pagination
            v-model:current="myAppsPage.current"
            v-model:page-size="myAppsPage.pageSize"
            :total="myAppsPage.total"
            :show-size-changer="false"
            :show-total="(total: number) => `共 ${total} 个应用`"
            @change="loadMyApps"
          />
        </div>
      </div>

      <!-- 精选案例 -->
      <div class="section">
        <h2 class="section-title">精选案例</h2>
        <div class="featured-grid" v-if="featuredApps.length > 0">
          <AppCard
            v-for="app in featuredApps"
            :key="app.id"
            :app="app"
            :featured="true"
            @view-chat="viewChat"
            @view-work="viewWork"
          />
        </div>
        <div class="empty-state" v-else>
          <div class="empty-card">
            <div class="empty-preview">
              <div class="empty-placeholder">✨</div>
            </div>
            <div class="empty-info">
              <div class="empty-line"></div>
              <div class="empty-line short"></div>
            </div>
          </div>
          <p class="empty-text">暂无精选案例</p>
        </div>
        <div class="pagination-wrapper" v-if="featuredAppsPage.total > 0">
          <a-pagination
            v-model:current="featuredAppsPage.current"
            v-model:page-size="featuredAppsPage.pageSize"
            :total="featuredAppsPage.total"
            :show-size-changer="false"
            :show-total="(total: number) => `共 ${total} 个案例`"
            @change="loadFeaturedApps"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#homePage {
  width: 100%;
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: linear-gradient(180deg, #e0f2fe 0%, #bae6fd 30%, #7dd3fc 60%, #38bdf8 100%);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
}

/* 科技感网格背景 */
#homePage::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px),
    linear-gradient(rgba(139, 92, 246, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.04) 1px, transparent 1px);
  background-size:
    100px 100px,
    100px 100px,
    20px 20px,
    20px 20px;
  pointer-events: none;
  animation: gridFloat 20s ease-in-out infinite;
}

/* 动态光效 */
#homePage::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(
      600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
      rgba(59, 130, 246, 0.08) 0%,
      rgba(139, 92, 246, 0.06) 40%,
      transparent 80%
    ),
    linear-gradient(45deg, transparent 30%, rgba(59, 130, 246, 0.04) 50%, transparent 70%),
    linear-gradient(-45deg, transparent 30%, rgba(139, 92, 246, 0.04) 50%, transparent 70%);
  pointer-events: none;
  animation: lightPulse 8s ease-in-out infinite alternate;
}

@keyframes gridFloat {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(5px, 5px);
  }
}

@keyframes lightPulse {
  0% {
    opacity: 0.3;
  }
  100% {
    opacity: 0.7;
  }
}

.container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 40px 60px 100px;
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
}

/* 移除居中光束效果 */

/* 英雄区域 */
.hero-section {
  text-align: center;
  padding: 80px 0 60px;
  margin-bottom: 28px;
  color: #1e293b;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(ellipse 800px 400px at center, rgba(59, 130, 246, 0.12) 0%, transparent 70%),
    linear-gradient(45deg, transparent 30%, rgba(139, 92, 246, 0.05) 50%, transparent 70%),
    linear-gradient(-45deg, transparent 30%, rgba(16, 185, 129, 0.04) 50%, transparent 70%);
  animation: heroGlow 10s ease-in-out infinite alternate;
}

@keyframes heroGlow {
  0% {
    opacity: 0.6;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes rotate {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.hero-title {
  font-size: 56px;
  font-weight: 700;
  margin: 0 0 20px;
  line-height: 1.2;
  color: #1e293b;
  letter-spacing: -1px;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.hero-title .cat-icon {
  font-size: 48px;
  display: inline-block;
  animation: catBounce 2s ease-in-out infinite;
}

@keyframes catBounce {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-5px) rotate(-5deg);
  }
  75% {
    transform: translateY(-5px) rotate(5deg);
  }
}

@keyframes titleShimmer {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.hero-description {
  font-size: 20px;
  margin: 0;
  opacity: 0.8;
  color: #64748b;
  position: relative;
  z-index: 2;
}

/* 输入区域 */
.input-section {
  position: relative;
  margin: 0 auto 24px;
  max-width: 1000px;
}

.input-panel {
  position: relative;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  padding: 24px;
  transition: all 0.3s ease;
}

.input-panel:hover {
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
}

.prompt-input {
  border: none;
  font-size: 16px;
  padding: 0;
  padding-bottom: 50px;
  background: transparent;
  resize: none;
  min-height: 120px;
  line-height: 1.6;
  color: #1e293b;
}

.prompt-input::placeholder {
  color: #94a3b8;
}

.prompt-input:focus {
  outline: none;
  box-shadow: none;
}

.input-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.input-left-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  color: #64748b;
  font-size: 14px;
  height: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.input-right-actions {
  display: flex;
  align-items: center;
}

.send-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  transition: all 0.3s ease;
}

.send-button:not(:disabled) {
  background: #3b82f6;
}

.send-button:not(:disabled):hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.send-button:disabled {
  background: #d1d5db;
  opacity: 0.6;
  cursor: not-allowed;
}

.send-icon {
  font-size: 18px;
  color: #fff;
  font-weight: 600;
}

/* 快捷按钮 */
.quick-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 60px;
  flex-wrap: wrap;
}

.quick-action-btn {
  border-radius: 12px;
  padding: 10px 24px;
  height: auto;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #475569;
  backdrop-filter: blur(15px);
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
}

.quick-action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent);
  transition: left 0.5s;
}

.quick-action-btn:hover::before {
  left: 100%;
}

.quick-action-btn:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(59, 130, 246, 0.4);
  color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
}

/* 区域标题 */
.section {
  margin-bottom: 60px;
}

.section-title {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 32px;
  color: #1e293b;
}

/* 我的作品网格 */
.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

/* 精选案例网格 */
.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-card {
  max-width: 400px;
  margin: 0 auto 24px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.empty-preview {
  height: 180px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-placeholder {
  font-size: 64px;
  opacity: 0.3;
}

.empty-info {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-line {
  height: 12px;
  background: #e5e7eb;
  border-radius: 6px;
  animation: pulse 1.5s ease-in-out infinite;
}

.empty-line.short {
  width: 70%;
}

.empty-line.shorter {
  width: 50%;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.empty-text {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .container {
    padding: 40px 40px;
  }
}

@media (max-width: 1200px) {
  .container {
    padding: 30px 30px;
  }
}

@media (max-width: 768px) {
  .container {
    padding: 20px 16px;
  }

  .hero-title {
    font-size: 36px;
    gap: 12px;
  }

  .hero-title .cat-icon {
    font-size: 36px;
  }

  .hero-description {
    font-size: 16px;
  }

  .input-panel {
    padding: 20px;
    border-radius: 16px;
  }

  .prompt-input {
    min-height: 100px;
    font-size: 15px;
  }

  .input-footer {
    padding: 10px 20px;
  }

  .action-btn {
    font-size: 13px;
    padding: 0 10px;
    height: 28px;
  }

  .send-button {
    width: 36px;
    height: 36px;
  }

  .app-grid,
  .featured-grid {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    justify-content: center;
    gap: 8px;
  }

  .quick-action-btn {
    padding: 8px 16px;
    font-size: 14px;
  }
}
</style>
