import { useUserStore } from "../store/userStore"
import { callApi } from "./axios"
import type {
  TaskListResponse,
  TaskTaxonomyResponse,
  TaskWeeklyReportResponse,
  TaskTypeResponse,
  TaskCategoryResponse,
  WorkTaskResponse,
  WorkTaskStatus,
  WorkTaskPriority,
  WorkTaskComplexity
} from "./models"

export interface TaskListQuery {
  weekStart: string
  search?: string
  typeId?: string
  categoryId?: string
  status?: WorkTaskStatus
  priority?: WorkTaskPriority
  complexity?: WorkTaskComplexity
  sortBy?: TaskSortBy
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}

export type TaskSortBy = "title" | "deadline" | "weight" | "priority" | "status" | "createdAt"

export interface WorkTaskInput {
  title: string
  description?: string
  categoryId: string
  deadline: string
  weight: number
  complexity: WorkTaskComplexity
  priority: WorkTaskPriority
  estimatedHours: number
  status: WorkTaskStatus
}

export interface TaskTypeInput {
  name: string
  description: string
  active: boolean
  sortOrder: number
}

export interface TaskCategoryInput {
  taskTypeId: string
  name: string
  description: string
  active: boolean
  sortOrder: number
  target: number
  unit: string
}

const toQuery = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value))
  })
  const result = params.toString()
  return result ? `?${result}` : ""
}

export const useTaskManagement = () => {
  const { accessToken } = useUserStore()

  const listTasks = (query: TaskListQuery) =>
    callApi<never, TaskListResponse>({
      method: "GET",
      path: `/v1/tasks${toQuery(query as unknown as Record<string, string | number | undefined>)}`,
      token: accessToken
    })

  const getTask = (id: string) =>
    callApi<never, { data: WorkTaskResponse }>({
      method: "GET",
      path: `/v1/tasks/${id}`,
      token: accessToken
    })

  const createTask = (data: WorkTaskInput) =>
    callApi<WorkTaskInput, { data: WorkTaskResponse }>({
      method: "POST",
      path: "/v1/tasks",
      data,
      token: accessToken
    })

  const updateTask = (id: string, data: WorkTaskInput) =>
    callApi<WorkTaskInput, { data: WorkTaskResponse }>({
      method: "PATCH",
      path: `/v1/tasks/${id}`,
      data,
      token: accessToken
    })

  const updateTaskStatus = (id: string, status: WorkTaskStatus) =>
    callApi<{ status: WorkTaskStatus }, { data: WorkTaskResponse }>({
      method: "PATCH",
      path: `/v1/tasks/${id}/status`,
      data: { status },
      token: accessToken
    })

  const deleteTask = (id: string) =>
    callApi<never, { deleted: boolean }>({
      method: "DELETE",
      path: `/v1/tasks/${id}`,
      token: accessToken
    })

  const getTaxonomy = () =>
    callApi<never, TaskTaxonomyResponse>({
      method: "GET",
      path: "/v1/tasks/taxonomy",
      token: accessToken
    })

  const getOptions = () =>
    callApi<never, TaskTaxonomyResponse>({
      method: "GET",
      path: "/v1/tasks/options",
      token: accessToken
    })

  const getWeeklyReport = (weekStart: string) =>
    callApi<never, TaskWeeklyReportResponse>({
      method: "GET",
      path: `/v1/tasks/reports/weekly?weekStart=${encodeURIComponent(weekStart)}`,
      token: accessToken
    })

  const saveType = (data: TaskTypeInput, id?: string) =>
    callApi<TaskTypeInput, { data: TaskTypeResponse }>({
      method: id ? "PATCH" : "POST",
      path: id ? `/v1/tasks/types/${id}` : "/v1/tasks/types",
      data,
      token: accessToken
    })

  const deleteType = (id: string) =>
    callApi<never, { deleted: boolean }>({
      method: "DELETE",
      path: `/v1/tasks/types/${id}`,
      token: accessToken
    })

  const saveCategory = (data: TaskCategoryInput, id?: string) =>
    callApi<TaskCategoryInput, { data: TaskCategoryResponse }>({
      method: id ? "PATCH" : "POST",
      path: id ? `/v1/tasks/categories/${id}` : "/v1/tasks/categories",
      data,
      token: accessToken
    })

  const deleteCategory = (id: string) =>
    callApi<never, { deleted: boolean }>({
      method: "DELETE",
      path: `/v1/tasks/categories/${id}`,
      token: accessToken
    })

  return {
    listTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getTaxonomy,
    getOptions,
    getWeeklyReport,
    saveType,
    deleteType,
    saveCategory,
    deleteCategory
  }
}
