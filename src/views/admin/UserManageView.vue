<template>
  <div id="userManagePage">
    <!-- 搜索表单 -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="账号">
        <a-input v-model:value="searchParams.userAccount" placeholder="输入账号" />
      </a-form-item>
      <a-form-item label="用户名">
        <a-input v-model:value="searchParams.userName" placeholder="输入用户名" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit">搜索</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <!-- 表格 -->
  </div>

  <a-table :columns="columns" :data-source="data" :pagination="pagination" @change="doTableChange">
    <template #bodyCell="{ column, record }">
      <template v-if="column.dataIndex === 'userAvatar'">
        <a-image :src="record.userAvatar" :width="120" />
      </template>
      <template v-else-if="column.dataIndex === 'userRole'">
        <div v-if="record.userRole === 'admin'">
          <a-tag color="green">管理员</a-tag>
        </div>
        <div v-else>
          <a-tag color="blue">普通用户</a-tag>
        </div>
      </template>
      <template v-else-if="column.dataIndex === 'createTime'">
        {{ dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') }}
      </template>
      <template v-else-if="column.key === 'action'">
        <a-popconfirm
          title="您确定删除吗?"
          ok-text="是"
          cancel-text="否"
          @confirm="confirm(record, $event)"
          @cancel="cancel"
        >
          <a-button danger>删除</a-button>
        </a-popconfirm>
      </template>
    </template>
  </a-table>
</template>
<script lang="ts" setup>
import { ref, computed } from 'vue'
import { deleteUsingPost, listUserVoByPage } from '@/api/userController'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
const columns = [
  {
    title: 'id',
    dataIndex: 'id',
  },
  {
    title: '账号',
    dataIndex: 'userAccount',
  },
  {
    title: '用户名',
    dataIndex: 'userName',
  },
  {
    title: '头像',
    dataIndex: 'userAvatar',
  },
  {
    title: '简介',
    dataIndex: 'userProfile',
  },
  {
    title: '用户角色',
    dataIndex: 'userRole',
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
  },
  {
    title: '操作',
    key: 'action',
  },
]

const data = ref<API.UserVO[]>([])
const total = ref<number>(0)
const searchParams = ref<API.UserQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})
const fetchData = async () => {
  const res = await listUserVoByPage(searchParams.value)
  console.log(res.data, 'res.data')
  if (res.data.code == 0 && res.data.data) {
    data.value = res.data.data.records ?? []
    total.value = res.data.data.totalPage ?? 0
  }
}

// 分页参数
const pagination = computed(() => {
  return {
    current: searchParams.value.pageNum ?? 1,
    pageSize: searchParams.value.pageSize ?? 10,
    total: total.value,
    showSizeChanger: true,
    onChange: (pageNum: number) => {
      searchParams.value.pageNum = pageNum
      fetchData()
    },
    onShowSizeChange: (current: number, pageSize: number) => {
      searchParams.value.pageSize = pageSize
      fetchData()
    },
  }
})

const doTableChange = (page: any) => {
  searchParams.value.pageNum = page.current
  searchParams.value.pageSize = page.pageSize
  fetchData()
}

const confirm = async (record: API.UserVO, e: MouseEvent) => {
  console.log(record)
  const res = await deleteUsingPost({
    id: record.id,
  })
  if (res.data.code == 0) {
    message.success('删除成功')
    fetchData()
  } else {
    message.error('删除失败:' + res.data.message)
  }
}

const cancel = (e: MouseEvent) => {
  console.log(e)
  message.error('Click on No')
}

// 获取数据
const doSearch = () => {
  // 重置页码
  searchParams.value.pageNum = 1
  fetchData()
}

fetchData()
</script>
