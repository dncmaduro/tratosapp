import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Badge, Button, Card, Collapse, Group, Modal, Pagination, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title, UnstyledButton } from "@mantine/core"
import { DateInput } from "@mantine/dates"
import { IconChevronDown, IconChevronRight, IconPlus, IconSearch } from "@tabler/icons-react"
import { format } from "date-fns"
import { CToast } from "../common/CToast"
import { useTaskManagement, type TaskListQuery, type TaskSortBy } from "../../hooks/useTaskManagement"
import type { TaskCategoryResponse, TaskTypeResponse, WorkTaskResponse, WorkTaskStatus } from "../../hooks/models"
import { complexityMeta, displayDate, getCategory, getType, parseWeek, priorityMeta, statusMeta } from "./task-utils"
import { emptyTaskValues, normalizeTaskForm, TaskForm, taskToFormValues } from "./TaskForm"

type TaskWorkspaceProps = { initialWeek?: string }

const pageSize = 20

export const TaskWorkspace = ({ initialWeek }: TaskWorkspaceProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const api = useTaskManagement()
  const [week, setWeek] = useState(parseWeek(initialWeek))
  const [filters, setFilters] = useState<Omit<TaskListQuery, "weekStart" | "page" | "limit"> & { search: string }>({ search: "", sortBy: "deadline", sortOrder: "asc" })
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState<WorkTaskResponse | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const weekStart = format(week, "yyyy-MM-dd")
  const query = { ...filters, weekStart, page, limit: pageSize }
  const optionsQuery = useQuery({ queryKey: ["task-options"], queryFn: () => api.getOptions(), select: (response) => response.data })
  const taskQuery = useQuery({ queryKey: ["managed-tasks", query], queryFn: () => api.listTasks(query), select: (response) => response.data })
  const reportQuery = useQuery({ queryKey: ["managed-task-report", weekStart], queryFn: () => api.getWeeklyReport(weekStart), select: (response) => response.data })
  const createMutation = useMutation({ mutationFn: api.createTask, onSuccess: () => { setOpened(false); queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }); queryClient.invalidateQueries({ queryKey: ["managed-task-report"] }); CToast.success({ title: "Đã tạo công việc" }) }, onError: () => CToast.error({ title: "Không tạo được công việc" }) })
  const updateMutation = useMutation({ mutationFn: ({ id, values }: { id: string; values: Parameters<typeof api.updateTask>[1] }) => api.updateTask(id, values), onSuccess: () => { setOpened(false); setEditing(null); queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }); queryClient.invalidateQueries({ queryKey: ["managed-task-report"] }); CToast.success({ title: "Đã cập nhật công việc" }) }, onError: () => CToast.error({ title: "Không cập nhật được công việc" }) })
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: WorkTaskStatus }) => api.updateTaskStatus(id, status), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["managed-tasks"] }); queryClient.invalidateQueries({ queryKey: ["managed-task-report"] }) }, onError: () => CToast.error({ title: "Không cập nhật được trạng thái" }) })

  const categories = optionsQuery.data?.categories ?? []
  const types = optionsQuery.data?.types ?? []
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, { type?: TaskTypeResponse; categories: Map<string, { category?: TaskCategoryResponse; tasks: WorkTaskResponse[] }> }>()
    for (const reportGroup of reportQuery.data?.groups ?? []) {
      const group = { type: types.find((type) => type._id === reportGroup.typeId), categories: new Map<string, { category?: TaskCategoryResponse; tasks: WorkTaskResponse[] }>() }
      for (const row of reportGroup.rows) {
        group.categories.set(row.categoryId, { category: categories.find((category) => category._id === row.categoryId), tasks: [] })
      }
      groups.set(reportGroup.typeId, group)
    }
    for (const task of taskQuery.data?.data ?? []) {
      const category = getCategory(task)
      const type = getType(category)
      const typeId = type?._id ?? "uncategorized"
      const group = groups.get(typeId) ?? { type, categories: new Map() }
      const categoryId = category?._id ?? "uncategorized"
      const categoryGroup = group.categories.get(categoryId) ?? { category, tasks: [] }
      categoryGroup.tasks.push(task)
      group.categories.set(categoryId, categoryGroup)
      groups.set(typeId, group)
    }
    return [...groups.entries()]
  }, [categories, reportQuery.data?.groups, taskQuery.data?.data, types])

  const reportByCategory = useMemo(() => {
    const map = new Map<string, NonNullable<typeof reportQuery.data>["groups"][number]["rows"][number]>()
    reportQuery.data?.groups.forEach((group) => group.rows.forEach((row) => map.set(row.categoryId, row)))
    return map
  }, [reportQuery.data])

  const reportTotals = reportQuery.data?.groups.reduce((totals, group) => group.rows.reduce((inner, row) => ({ total: inner.total + row.total, completed: inner.completed + row.completed }), totals), { total: 0, completed: 0 }) ?? { total: 0, completed: 0 }
  const completed = reportTotals.completed
  const completedWeight = reportQuery.data?.groups.reduce((sum, group) => sum + group.completedWeight, 0) ?? 0
  const totalWeight = reportQuery.data?.groups.reduce((sum, group) => sum + group.totalWeight, 0) ?? 0
  const totalPages = Math.max(1, Math.ceil((taskQuery.data?.total ?? 0) / pageSize))

  const toggleSort = (sortBy: TaskSortBy) => {
    setFilters((current) => ({ ...current, sortBy, sortOrder: current.sortBy === sortBy && current.sortOrder === "asc" ? "desc" : "asc" }))
    setPage(1)
  }

  const resetAndOpen = (task?: WorkTaskResponse) => {
    setEditing(task ?? null)
    setOpened(true)
  }

  const submit = (values: Parameters<typeof api.createTask>[0]) => {
    if (editing) updateMutation.mutate({ id: editing._id, values: normalizeTaskForm(values) })
    else createMutation.mutate(normalizeTaskForm(values))
  }

  return (
    <Stack p={12} gap={16}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Text c="dimmed" fz="sm">Quản lý công việc</Text>
          <Title order={2}>Công việc theo tuần</Title>
        </div>
        <Group>
          <DateInput label="Tuần bắt đầu" valueFormat="DD/MM/YYYY" value={week} onChange={(value) => { if (value) { setWeek(parseWeek(format(value, "yyyy-MM-dd"))); setPage(1) } }} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => resetAndOpen()}>Tạo công việc</Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <SummaryCard label="Tổng công việc" value={String(taskQuery.data?.total ?? 0)} />
        <SummaryCard label="Đã hoàn thành" value={`${completed}/${reportTotals.total}`} />
        <SummaryCard label="Trọng số hoàn thành" value={`${completedWeight}%`} />
        <SummaryCard label="Tổng trọng số" value={`${totalWeight}%`} />
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" grow>
          <TextInput label="Tìm công việc" placeholder="Tìm theo tiêu đề" leftSection={<IconSearch size={16} />} value={filters.search} onChange={(event) => { setFilters((current) => ({ ...current, search: event.currentTarget.value })); setPage(1) }} />
          <Select label="Loại công việc" placeholder="Tất cả" clearable data={types.map((type) => ({ value: type._id, label: type.name }))} value={filters.typeId ?? null} onChange={(value) => { setFilters((current) => ({ ...current, typeId: value ?? undefined, categoryId: undefined })); setPage(1) }} />
          <Select label="Phân loại" placeholder="Tất cả" clearable data={categories.filter((category) => !filters.typeId || category.taskTypeId === filters.typeId).map((category) => ({ value: category._id, label: category.name }))} value={filters.categoryId ?? null} onChange={(value) => { setFilters((current) => ({ ...current, categoryId: value ?? undefined })); setPage(1) }} />
          <Select label="Trạng thái" placeholder="Tất cả" clearable data={[{ value: "todo", label: "Cần làm" }, { value: "in_progress", label: "Đang làm" }, { value: "completed", label: "Hoàn thành" }, { value: "cancelled", label: "Đã hủy" }]} value={filters.status ?? null} onChange={(value) => { setFilters((current) => ({ ...current, status: value as TaskListQuery["status"] })); setPage(1) }} />
        </Group>
      </Paper>

      {taskQuery.isLoading ? <Paper withBorder p="xl"><Text ta="center" c="dimmed">Đang tải công việc…</Text></Paper> : taskQuery.isError ? <Paper withBorder p="xl"><Text ta="center" c="red">Không tải được danh sách công việc.</Text></Paper> : groupedTasks.length === 0 ? <Paper withBorder p="xl"><Text ta="center" c="dimmed">Không có công việc trong tuần này.</Text></Paper> : groupedTasks.map(([typeId, group]) => {
        const isOpen = openGroups[typeId] ?? true
        return <Card key={typeId} withBorder radius="md" padding={0}>
          <UnstyledButton className="w-full" onClick={() => setOpenGroups((current) => ({ ...current, [typeId]: !isOpen }))}>
            <Group justify="space-between" px="md" py="sm">
              <Group gap="xs">{isOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}<Text fw={700}>{group.type?.name ?? "Chưa phân loại"}</Text></Group>
              <Text c="dimmed" fz="sm">Trọng số: {group.categories.size ? [...group.categories.keys()].reduce((sum, id) => sum + (reportByCategory.get(id)?.totalWeight ?? 0), 0) : 0}%</Text>
            </Group>
          </UnstyledButton>
          <Collapse in={isOpen}>
            {[...group.categories.entries()].map(([categoryId, categoryGroup]) => {
              const report = reportByCategory.get(categoryId)
              return <div key={categoryId} className="border-t border-gray-100">
                <Group justify="space-between" px="md" py="xs" bg="gray.0">
                  <Text fw={600} fz="sm">{categoryGroup.category?.name ?? "Chưa phân loại"}</Text>
                  {report && <Text fz="xs" c="dimmed">{report.completed}/{report.target} {report.unit} · {Math.round(report.progress)}%</Text>}
                </Group>
                <Table.ScrollContainer minWidth={900}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th><SortButton label="Công việc" field="title" current={filters} onClick={toggleSort} /></Table.Th><Table.Th><SortButton label="Hạn hoàn thành" field="deadline" current={filters} onClick={toggleSort} /></Table.Th><Table.Th><SortButton label="Trọng số" field="weight" current={filters} onClick={toggleSort} /></Table.Th><Table.Th><SortButton label="Ưu tiên" field="priority" current={filters} onClick={toggleSort} /></Table.Th><Table.Th>Độ phức tạp</Table.Th><Table.Th>Trạng thái</Table.Th><Table.Th w={90}></Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>{categoryGroup.tasks.map((task) => <Table.Tr key={task._id}>
                      <Table.Td><Button variant="subtle" px={0} onClick={() => navigate({ to: "/tasks/$taskId", params: { taskId: task._id } })}>{task.title}</Button></Table.Td>
                      <Table.Td>{displayDate(task.deadline)}</Table.Td>
                      <Table.Td>{task.weight}%</Table.Td>
                      <Table.Td><Badge color={priorityMeta[task.priority].color}>{priorityMeta[task.priority].label}</Badge></Table.Td>
                      <Table.Td><Badge color={complexityMeta[task.complexity].color}>{complexityMeta[task.complexity].label}</Badge></Table.Td>
                      <Table.Td><Select size="xs" data={Object.entries(statusMeta).map(([value, meta]) => ({ value, label: meta.label }))} value={task.status} onChange={(value) => { if (value) statusMutation.mutate({ id: task._id, status: value as WorkTaskStatus }) }} /></Table.Td>
                      <Table.Td><Button size="xs" variant="subtle" onClick={() => resetAndOpen(task)}>Sửa</Button></Table.Td>
                    </Table.Tr>)}</Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </div>
            })}
          </Collapse>
        </Card>
      })}

      {totalPages > 1 && <Group justify="center"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}

      <Modal opened={opened} onClose={() => { setOpened(false); setEditing(null) }} title={editing ? `Sửa công việc: ${editing.title}` : "Tạo công việc mới"} centered size="lg" zIndex={500}>
        <TaskForm initialValues={editing ? taskToFormValues(editing) : emptyTaskValues(format(week, "yyyy-MM-dd"), categories[0]?._id ?? "")} categories={categories} onSubmit={submit} onCancel={() => setOpened(false)} submitting={createMutation.isPending || updateMutation.isPending} />
      </Modal>
    </Stack>
  )
}

const SummaryCard = ({ label, value }: { label: string; value: string }) => <Card withBorder radius="md"><Text c="dimmed" fz="sm">{label}</Text><Text fw={700} fz={24} mt={4}>{value}</Text></Card>

const SortButton = ({ label, field, current, onClick }: { label: string; field: TaskSortBy; current: { sortBy?: TaskSortBy; sortOrder?: "asc" | "desc" }; onClick: (field: TaskSortBy) => void }) => <UnstyledButton onClick={() => onClick(field)}><Group gap={4} wrap="nowrap"><Text size="sm" fw={600}>{label}</Text>{current.sortBy === field && <Text size="xs" c="indigo">{current.sortOrder === "asc" ? "↑" : "↓"}</Text>}</Group></UnstyledButton>
