// @ts-ignore
/* eslint-disable */
import request from '@/request'

/** 此处后端没有提供注释 GET /static/deploy/${param0}/&#42;&#42; */
export async function serveStaticDeployResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.serveStaticDeployResourceParams,
  options?: { [key: string]: any }
) {
  const { deployKey: param0, ...queryParams } = params
  return request<string>(`/static/deploy/${param0}/**`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /static/preview/${param0}/&#42;&#42; */
export async function serveStaticPreviewResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.serveStaticPreviewResourceParams,
  options?: { [key: string]: any }
) {
  const { fileName: param0, ...queryParams } = params
  return request<string>(`/static/preview/${param0}/**`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  })
}
