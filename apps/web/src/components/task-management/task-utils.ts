import { addDays, format, startOfWeek } from "date-fns"
import type { TaskCategoryResponse, TaskTypeResponse, WorkTaskResponse } from "../../hooks/models"

export const formatWeek = (value: Date) => format(value, "yyyy-MM-dd")
export const parseWeek = (value?: string) => {
  const date = value ? new Date(`${value}T00:00:00`) : new Date()
  return startOfWeek(Number.isNaN(date.valueOf()) ? new Date() : date, { weekStartsOn: 1 })
}
export const displayDate = (value: string) => format(new Date(value), "dd/MM/yyyy")
export const weekEnd = (value: Date) => addDays(value, 6)

export const getCategory = (task: WorkTaskResponse) =>
  typeof task.categoryId === "string" ? undefined : task.categoryId

export const getType = (category: TaskCategoryResponse | undefined) => {
  const taskType = category?.taskTypeId
  return typeof taskType === "string" ? undefined : taskType as unknown as TaskTypeResponse | undefined
}

export const statusMeta = {
  todo: { label: "Cần làm", color: "blue" },
  in_progress: { label: "Đang làm", color: "yellow" },
  completed: { label: "Hoàn thành", color: "teal" },
  cancelled: { label: "Đã hủy", color: "gray" }
} as const

export const priorityMeta = {
  low: { label: "Thấp", color: "gray" },
  medium: { label: "Trung bình", color: "blue" },
  high: { label: "Cao", color: "orange" },
  urgent: { label: "Khẩn", color: "red" }
} as const

export const complexityMeta = {
  low: { label: "Thấp", color: "gray" },
  medium: { label: "Trung bình", color: "blue" },
  high: { label: "Cao", color: "orange" }
} as const
