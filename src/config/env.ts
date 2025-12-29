/**
 * 环境变量配置
 */

import { CodeGenTypeEnum } from "@/utils/codeGenTypes"

// 应用部署域名
export const DEPLOY_DOMAIN = import.meta.env.VITE_DEPLOY_DOMAIN || 'http://localhost'

// API 基础地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8123/api'

// 静态资源地址
export const STATIC_BASE_URL = `${API_BASE_URL}/static`

// 获取部署应用的完整URL
export const getDeployUrl = (deployKey: string) => {
  return `${DEPLOY_DOMAIN}/${deployKey}`
}

// 获取静态资源预览URL
export const getStaticPreviewUrl = (codeGenType: string, appId: string) => {
  // 普通项目[单文件/多文件]
  let baseUrl = `${STATIC_BASE_URL}/preview/${codeGenType}_${appId}/`
  // Vue 项目模式
  console.log(codeGenType, 'codeGenType')
  if (codeGenType == CodeGenTypeEnum.VUE_PROJECT) {
    baseUrl = `${baseUrl}dist/index.html`
  }
  console.log(baseUrl, 'baseUrl')
  return baseUrl
}
