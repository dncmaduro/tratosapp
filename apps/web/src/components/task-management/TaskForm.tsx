import { Button, Group, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core"
import { DateInput } from "@mantine/dates"
import { useForm } from "@mantine/form"
import { useEffect } from "react"
import { format } from "date-fns"
import type { TaskCategoryResponse, WorkTaskComplexity, WorkTaskPriority, WorkTaskStatus, WorkTaskResponse } from "../../hooks/models"
import type { WorkTaskInput } from "../../hooks/useTaskManagement"

export type TaskFormValues = WorkTaskInput

const statusOptions = [
  { value: "todo", label: "Cần làm" },
  { value: "in_progress", label: "Đang làm" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" }
]

const categoryOptions = (categories: TaskCategoryResponse[]) =>
  categories.filter((category) => category.active).map((category) => ({ value: category._id, label: category.name }))

export const emptyTaskValues = (deadline: string, categoryId = ""): TaskFormValues => ({
  title: "",
  description: "",
  categoryId,
  deadline,
  weight: 0,
  complexity: "medium",
  priority: "medium",
  estimatedHours: 0,
  status: "todo"
})

export const taskToFormValues = (task: WorkTaskResponse): TaskFormValues => ({
  title: task.title,
  description: task.description,
  categoryId: typeof task.categoryId === "string" ? task.categoryId : task.categoryId._id,
  deadline: task.deadline.slice(0, 10),
  weight: task.weight,
  complexity: task.complexity,
  priority: task.priority,
  estimatedHours: task.estimatedHours,
  status: task.status
})

export const TaskForm = ({
  initialValues,
  categories,
  onSubmit,
  onCancel,
  submitting
}: {
  initialValues: TaskFormValues
  categories: TaskCategoryResponse[]
  onSubmit: (values: TaskFormValues) => void
  onCancel?: () => void
  submitting?: boolean
}) => {
  const form = useForm<TaskFormValues>({
    initialValues,
    validate: {
      title: (value) => (value.trim() ? null : "Vui lòng nhập tiêu đề"),
      categoryId: (value) => (value ? null : "Vui lòng chọn loại task"),
      deadline: (value) => (value ? null : "Vui lòng chọn deadline"),
      weight: (value) => (value >= 0 ? null : "Trọng số không được âm"),
      estimatedHours: (value) => (value >= 0 ? null : "Số giờ không được âm")
    }
  })

  useEffect(() => {
    form.setValues(initialValues)
    form.resetDirty(initialValues)
  }, [initialValues])

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="sm">
        <TextInput label="Tên task" withAsterisk {...form.getInputProps("title")} />
        <Textarea label="Mô tả" minRows={3} autosize {...form.getInputProps("description")} />
        <Select label="Phân loại" withAsterisk data={categoryOptions(categories)} searchable {...form.getInputProps("categoryId")} />
        <Group grow align="flex-start">
          <DateInput label="Deadline" valueFormat="DD/MM/YYYY" withAsterisk value={form.values.deadline ? new Date(`${form.values.deadline}T00:00:00`) : null} onChange={(value) => form.setFieldValue("deadline", value ? format(value, "yyyy-MM-dd") : "")} error={form.errors.deadline} />
          <NumberInput label="Trọng số (%)" min={0} decimalScale={2} {...form.getInputProps("weight")} />
        </Group>
        <Group grow align="flex-start">
          <Select label="Độ ưu tiên" data={[{ value: "low", label: "Thấp" }, { value: "medium", label: "Trung bình" }, { value: "high", label: "Cao" }, { value: "urgent", label: "Khẩn" }]} {...form.getInputProps("priority")} />
          <Select label="Độ phức tạp" data={[{ value: "low", label: "Thấp" }, { value: "medium", label: "Trung bình" }, { value: "high", label: "Cao" }]} {...form.getInputProps("complexity")} />
        </Group>
        <Group grow align="flex-start">
          <NumberInput label="Số giờ dự kiến" min={0} decimalScale={2} {...form.getInputProps("estimatedHours")} />
          <Select label="Trạng thái" data={statusOptions} {...form.getInputProps("status")} />
        </Group>
        <Group justify="flex-end" mt="sm">
          {onCancel && <Button variant="default" onClick={onCancel}>Hủy</Button>}
          <Button type="submit" loading={submitting}>Lưu task</Button>
        </Group>
      </Stack>
    </form>
  )
}

export const normalizeTaskForm = (values: TaskFormValues): TaskFormValues => ({
  ...values,
  title: values.title.trim(),
  description: values.description?.trim() ?? "",
  weight: Number(values.weight),
  estimatedHours: Number(values.estimatedHours),
  complexity: values.complexity as WorkTaskComplexity,
  priority: values.priority as WorkTaskPriority,
  status: values.status as WorkTaskStatus
})
