// @ts-ignore
/* eslint-disable */
import request from '@/request'

/** 文件上传接口 POST /file/upload */
export async function upload(file: File, options?: { [key: string]: any }) {
  const formData = new FormData()
  formData.append('file', file)
  
  return request<API.BaseResponseFileUploadVO>('/file/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    data: formData,
    ...(options || {}),
  })
}
