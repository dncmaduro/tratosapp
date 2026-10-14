import { useQuery } from "@tanstack/react-query"
import { Badge, Card, Group, Paper, Progress, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core"
import { DateInput } from "@mantine/dates"
import { useState } from "react"
import { format } from "date-fns"
import { useTaskManagement } from "../../hooks/useTaskManagement"
import { parseWeek } from "./task-utils"

export const TaskReportsPage = () => {
  const api = useTaskManagement()
  const [week, setWeek] = useState(parseWeek())
  const weekStart = format(week, "yyyy-MM-dd")
  const query = useQuery({ queryKey: ["managed-task-report", weekStart], queryFn: () => api.getWeeklyReport(weekStart), select: (response) => response.data })
  const groups = query.data?.groups ?? []
  const completedWeight = groups.reduce((sum, group) => sum + group.completedWeight, 0)
  const totalWeight = groups.reduce((sum, group) => sum + group.totalWeight, 0)
  const completed = groups.reduce((sum, group) => sum + group.rows.reduce((rowSum, row) => rowSum + row.completed, 0), 0)
  const total = groups.reduce((sum, group) => sum + group.rows.reduce((rowSum, row) => rowSum + row.total, 0), 0)

  return <Stack p={12} gap={16}>
    <Group justify="space-between" align="flex-end"><div><Text c="dimmed" fz="sm">Báo cáo</Text><Title order={2}>Tổng hợp công việc theo tuần</Title></div><DateInput label="Tuần bắt đầu" valueFormat="DD/MM/YYYY" value={week} onChange={(value) => { if (value) setWeek(parseWeek(format(value, "yyyy-MM-dd"))) }} /></Group>
    <SimpleGrid cols={{ base: 1, sm: 4 }}><ReportCard label="Task hoàn thành" value={`${completed}/${total}`} /><ReportCard label="Trọng số hoàn thành" value={`${completedWeight}%`} /><ReportCard label="Tổng trọng số" value={`${totalWeight}%`} /><ReportCard label="Số nhóm KPI" value={String(groups.length)} /></SimpleGrid>
    {query.isLoading ? <Paper p="xl"><Text ta="center" c="dimmed">Đang tải báo cáo…</Text></Paper> : query.isError ? <Paper p="xl"><Text ta="center" c="red">Không tải được báo cáo.</Text></Paper> : groups.length === 0 ? <Paper p="xl"><Text ta="center" c="dimmed">Chưa có task trong tuần này.</Text></Paper> : groups.map((group) => <Card key={group.typeId} withBorder radius="md"><Group justify="space-between"><Text fw={700} fz="lg">{group.name}</Text><Badge variant="light">Trọng số: {group.totalWeight}%</Badge></Group><Stack gap="md" mt="md">{group.rows.map((row) => <div key={row.categoryId}><Group justify="space-between" mb={4}><Text fw={600} size="sm">{row.name}</Text><Text size="sm" c="dimmed">{row.completed}/{row.target} {row.unit} · {row.progress.toFixed(0)}%</Text></Group><Progress value={row.progress} color={row.progress >= 100 ? "teal" : "indigo"} /><Text size="xs" c="dimmed" mt={4}>Trọng số hoàn thành {row.completedWeight}% / {row.totalWeight}%</Text></div>)}</Stack><Table.ScrollContainer minWidth={650} mt="lg"><Table><Table.Thead><Table.Tr><Table.Th>Chỉ tiêu</Table.Th><Table.Th>Mục tiêu</Table.Th><Table.Th>Hoàn thành</Table.Th><Table.Th>Trọng số</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{group.rows.map((row) => <Table.Tr key={row.categoryId}><Table.Td>{row.name}</Table.Td><Table.Td>{row.target} {row.unit}</Table.Td><Table.Td>{row.completed}</Table.Td><Table.Td>{row.completedWeight}% / {row.totalWeight}%</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Card>)}
  </Stack>
}

const ReportCard = ({ label, value }: { label: string; value: string }) => <Card withBorder radius="md"><Text c="dimmed" size="sm">{label}</Text><Text fw={700} fz={24} mt={4}>{value}</Text></Card>
