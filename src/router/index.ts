import ACCESS_ENUM from '@/access/accessEnum'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: '主页',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/about',
      name: '关于',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/user/login',
      name: '用户登录',
      component: () => import('../views/user/UserLogin.vue'),
    },
    {
      path: '/user/register',
      name: '用户注册',
      component: () => import('../views/user/UserRegister.vue'),
    },
    {
      path: '/admin/userManage',
      name: '用户管理',
      component: () => import('../views/admin/UserManageView.vue'),
      meta: {
        access: ACCESS_ENUM.ADMIN
      }
    },
    {
      path: '/:pathMatch(.*)*',
      name: '找不到页面',
      component: () => import('../views/noAuth/index.vue'),
      meta: {
        access: ACCESS_ENUM.NOT_LOGIN
      }
    }
  ],

})



export default router
