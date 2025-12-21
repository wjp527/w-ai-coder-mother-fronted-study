// import { useLoginUserStore } from '@/stores/loginUser'
// import { message } from 'ant-design-vue'
// import router from '@/router'

// // 是否为首次获取都登陆用户
// let firstFetchLoginUser = true

// router.beforeEach(async (to, from, next) => {
//   const loginUserStore = useLoginUserStore()
//   let loginUser = loginUserStore.loginUser
//   // 面向页面刷新，首次加载时，能够等后端返回用户嘻嘻在校验权限
//   if (firstFetchLoginUser) {
//     await loginUserStore.fetchLoginUser() // 异步获取登陆用户信息
//     loginUser = loginUserStore.loginUser
//     firstFetchLoginUser = false
//   }

//   const toUrl = to.fullPath
//   if (toUrl.startsWith('/admin')) {
//     if (!loginUser || loginUser.userRole != 'admin') {
//       message.error('无权访问')
//       next({ path: `/user/login?redirect=${to.fullPath}` })
//       return
//     }
//   }
//   next() // 继续执行后续的钩子函数
// })
