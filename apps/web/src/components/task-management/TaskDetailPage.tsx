import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Badge, Button, Card, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core"
import { IconArrowLeft, IconEdit, IconTrash } from "@tabler/icons-react"
import { modals } from "@mantine/modals"
import { CToast } from "../common/CToast"
import { useTaskManagement } from "../../hooks/useTaskManagement"
import { complexityMeta, displayDate, getCategory, priorityMeta, statusMeta } from "./task-utils"

export const TaskDetailPage = () => {
  const { taskId } = useParams({ strict: false }) as { taskId: string }
  const navigate = useNavigate()
  const api = useTaskManagement()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ["managed-task", taskId], queryFn: () => api.getTask(taskId), select: (response) => response.data.data })
  const deleteMutation = useMutation({ mutationFn: api.deleteTask, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }); CToast.success({ title: "Đã xóa task" }); navigate({ to: "/tasks" }) }, onError: () => CToast.error({ title: "Không xóa được task" }) })
  const task = query.data
  const category = task ? getCategory(task) : undefined

  if (query.isLoading) return <Paper p="xl"><Group justify="center"><Loader /></Group></Paper>
  if (query.isError || !task) return <Paper p="xl"><Text c="red" ta="center">Không tải được task.</Text></Paper>

  return <Stack p={12} gap={16}>
    <Group justify="space-between" align="flex-start">
      <div>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate({ to: "/tasks" })}>Quay lại danh sách</Button>
        <Title order={2} mt="sm">{task.title}</Title>
        <Text c="dimmed" mt={4}>{category?.name ?? "Chưa phân loại"}</Text>
      </div>
      <Group>
        <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate({ to: "/tasks/$taskId/edit", params: { taskId } })}>Chỉnh sửa</Button>
        <Button color="red" variant="light" leftSection={<IconTrash size={16} />} onClick={() => modals.openConfirmModal({ title: "Xóa task?", children: <Text size="sm">Task này sẽ bị xóa khỏi danh sách.</Text>, labels: { confirm: "Xóa", cancel: "Hủy" }, confirmProps: { color: "red" }, onConfirm: () => deleteMutation.mutate(taskId) })}>Xóa</Button>
      </Group>
    </Group>
    <Card withBorder radius="md">
      <Stack gap="md">
        <Text>{task.description || "Task chưa có mô tả."}</Text>
        <Group gap="xs"><Badge color={statusMeta[task.status].color}>{statusMeta[task.status].label}</Badge><Badge color={priorityMeta[task.priority].color}>{priorityMeta[task.priority].label}</Badge><Badge color={complexityMeta[task.complexity].color}>{complexityMeta[task.complexity].label}</Badge></Group>
        <Group grow>
          <Info label="Deadline" value={displayDate(task.deadline)} />
          <Info label="Trọng số" value={`${task.weight}%`} />
          <Info label="Giờ dự kiến" value={`${task.estimatedHours} giờ`} />
        </Group>
      </Stack>
    </Card>
  </Stack>
}

const Info = ({ label, value }: { label: string; value: string }) => <div><Text size="xs" c="dimmed">{label}</Text><Text fw={600} mt={3}>{value}</Text></div>
