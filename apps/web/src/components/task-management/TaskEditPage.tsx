import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Loader, Paper, Text } from "@mantine/core"
import { CToast } from "../common/CToast"
import { useTaskManagement } from "../../hooks/useTaskManagement"
import { TaskForm, normalizeTaskForm, taskToFormValues } from "./TaskForm"

export const TaskEditPage = () => {
  const { taskId } = useParams({ strict: false }) as { taskId: string }
  const navigate = useNavigate()
  const api = useTaskManagement()
  const queryClient = useQueryClient()
  const taskQuery = useQuery({ queryKey: ["managed-task", taskId], queryFn: () => api.getTask(taskId), select: (response) => response.data.data })
  const optionsQuery = useQuery({ queryKey: ["task-options"], queryFn: () => api.getOptions(), select: (response) => response.data })
  const updateMutation = useMutation({ mutationFn: (values: Parameters<typeof api.updateTask>[1]) => api.updateTask(taskId, values), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["managed-task", taskId] }); queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }); CToast.success({ title: "Đã cập nhật task" }); navigate({ to: "/tasks/$taskId", params: { taskId } }) }, onError: () => CToast.error({ title: "Không cập nhật được task" }) })

  if (taskQuery.isLoading || optionsQuery.isLoading) return <Paper p="xl"><Loader /></Paper>
  if (taskQuery.isError || optionsQuery.isError || !taskQuery.data) return <Paper p="xl"><Text c="red">Không tải được dữ liệu task.</Text></Paper>

  return <Paper withBorder m={12} p="lg" radius="md"><Text fw={700} fz="lg" mb="md">Chỉnh sửa task</Text><TaskForm initialValues={taskToFormValues(taskQuery.data)} categories={optionsQuery.data?.categories ?? []} onSubmit={(values) => updateMutation.mutate(normalizeTaskForm(values))} onCancel={() => navigate({ to: "/tasks/$taskId", params: { taskId } })} submitting={updateMutation.isPending} /></Paper>
}
