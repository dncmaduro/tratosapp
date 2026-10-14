import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Text, Textarea, TextInput, Title } from "@mantine/core"
import { useForm } from "@mantine/form"
import { modals } from "@mantine/modals"
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react"
import { CToast } from "../common/CToast"
import { useTaskManagement, type TaskCategoryInput, type TaskTypeInput } from "../../hooks/useTaskManagement"
import type { TaskCategoryResponse, TaskTypeResponse } from "../../hooks/models"

type Editor = { kind: "type"; value?: TaskTypeResponse } | { kind: "category"; value?: TaskCategoryResponse }

export const TaskAdminPage = () => {
  const api = useTaskManagement()
  const client = useQueryClient()
  const [editor, setEditor] = useState<Editor | null>(null)
  const query = useQuery({ queryKey: ["task-taxonomy"], queryFn: () => api.getTaxonomy(), select: (response) => response.data })
  const refresh = () => { void client.invalidateQueries({ queryKey: ["task-taxonomy"] }); void client.invalidateQueries({ queryKey: ["task-options"] }) }
  const saveType = useMutation({ mutationFn: ({ value, id }: { value: TaskTypeInput; id?: string }) => api.saveType(value, id), onSuccess: () => { setEditor(null); refresh(); CToast.success({ title: "Đã lưu loại task" }) }, onError: () => CToast.error({ title: "Không lưu được loại task" }) })
  const saveCategory = useMutation({ mutationFn: ({ value, id }: { value: TaskCategoryInput; id?: string }) => api.saveCategory(value, id), onSuccess: () => { setEditor(null); refresh(); CToast.success({ title: "Đã lưu phân loại task" }) }, onError: () => CToast.error({ title: "Không lưu được phân loại task" }) })
  const deleteType = useMutation({ mutationFn: api.deleteType, onSuccess: () => { refresh(); CToast.success({ title: "Đã xóa loại task" }) }, onError: () => CToast.error({ title: "Không thể xóa loại task đang được sử dụng" }) })
  const deleteCategory = useMutation({ mutationFn: api.deleteCategory, onSuccess: () => { refresh(); CToast.success({ title: "Đã xóa phân loại task" }) }, onError: () => CToast.error({ title: "Không thể xóa phân loại task đang được sử dụng" }) })
  const types = query.data?.types ?? []
  const categories = query.data?.categories ?? []

  return <Stack p={12} gap={16}>
    <Group justify="space-between"><div><Text c="dimmed" fz="sm">Task workspace</Text><Title order={2}>Quản trị taxonomy</Title><Text c="dimmed" size="sm" mt={4}>Quản lý loại task, phân loại và mục tiêu theo từng chỉ tiêu.</Text></div><Group><Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setEditor({ kind: "type" })}>Thêm loại</Button><Button leftSection={<IconPlus size={16} />} onClick={() => setEditor({ kind: "category" })}>Thêm phân loại</Button></Group></Group>
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <TaxonomyCard title="Loại task" count={types.length}><Table.ScrollContainer minWidth={520}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Tên</Table.Th><Table.Th>Trạng thái</Table.Th><Table.Th w={100}></Table.Th></Table.Tr></Table.Thead><Table.Tbody>{types.map((type) => <Table.Tr key={type._id}><Table.Td><Text fw={600}>{type.name}</Text>{type.description && <Text size="xs" c="dimmed">{type.description}</Text>}</Table.Td><Table.Td><Badge color={type.active ? "teal" : "gray"}>{type.active ? "Đang dùng" : "Tắt"}</Badge></Table.Td><Table.Td><Group gap={4} justify="flex-end"><Button size="xs" variant="subtle" onClick={() => setEditor({ kind: "type", value: type })}><IconEdit size={15} /></Button><Button size="xs" variant="subtle" color="red" onClick={() => confirmDelete("loại task", type.name, () => deleteType.mutate(type._id))}><IconTrash size={15} /></Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></TaxonomyCard>
      <TaxonomyCard title="Phân loại task" count={categories.length}><Table.ScrollContainer minWidth={700}><Table highlightOnHover><Table.Thead><Table.Tr><Table.Th>Tên</Table.Th><Table.Th>Loại</Table.Th><Table.Th>Mục tiêu</Table.Th><Table.Th>Trạng thái</Table.Th><Table.Th w={100}></Table.Th></Table.Tr></Table.Thead><Table.Tbody>{categories.map((category) => <Table.Tr key={category._id}><Table.Td><Text fw={600}>{category.name}</Text>{category.description && <Text size="xs" c="dimmed">{category.description}</Text>}</Table.Td><Table.Td>{types.find((type) => type._id === category.taskTypeId)?.name ?? "—"}</Table.Td><Table.Td>{category.target} {category.unit}</Table.Td><Table.Td><Badge color={category.active ? "teal" : "gray"}>{category.active ? "Đang dùng" : "Tắt"}</Badge></Table.Td><Table.Td><Group gap={4} justify="flex-end"><Button size="xs" variant="subtle" onClick={() => setEditor({ kind: "category", value: category })}><IconEdit size={15} /></Button><Button size="xs" variant="subtle" color="red" onClick={() => confirmDelete("phân loại task", category.name, () => deleteCategory.mutate(category._id))}><IconTrash size={15} /></Button></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></TaxonomyCard>
    </SimpleGrid>
    {editor?.kind === "type" && <TypeModal editor={editor} onClose={() => setEditor(null)} onSubmit={(value) => saveType.mutate({ value, id: editor.value?._id })} loading={saveType.isPending} />}
    {editor?.kind === "category" && <CategoryModal editor={editor} types={types} onClose={() => setEditor(null)} onSubmit={(value) => saveCategory.mutate({ value, id: editor.value?._id })} loading={saveCategory.isPending} />}
  </Stack>
}

const TaxonomyCard = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => <Card withBorder radius="md" padding="md"><Group justify="space-between" mb="sm"><Text fw={700}>{title}</Text><Badge variant="light">{count}</Badge></Group>{children}</Card>

const confirmDelete = (label: string, name: string, onConfirm: () => void) => modals.openConfirmModal({ title: `Xóa ${label}?`, children: <Text size="sm">Bạn có chắc muốn xóa “{name}” không?</Text>, labels: { confirm: "Xóa", cancel: "Hủy" }, confirmProps: { color: "red" }, onConfirm })

const TypeModal = ({ editor, onClose, onSubmit, loading }: { editor: Extract<Editor, { kind: "type" }>; onClose: () => void; onSubmit: (value: TaskTypeInput) => void; loading: boolean }) => {
  const form = useForm<TaskTypeInput>({ initialValues: { name: editor.value?.name ?? "", description: editor.value?.description ?? "", active: editor.value?.active ?? true, sortOrder: editor.value?.sortOrder ?? 0 }, validate: { name: (value) => (value.trim() ? null : "Nhập tên loại task") } })
  return <Modal opened onClose={onClose} title={editor.value ? "Sửa loại task" : "Thêm loại task"} centered><form onSubmit={form.onSubmit((value) => onSubmit({ ...value, name: value.name.trim(), description: value.description.trim() }))}><Stack><TextInput label="Tên" withAsterisk {...form.getInputProps("name")} /><Textarea label="Mô tả" {...form.getInputProps("description")} /><NumberInput label="Thứ tự" min={0} {...form.getInputProps("sortOrder")} /><Switch label="Đang sử dụng" {...form.getInputProps("active", { type: "checkbox" })} /><Group justify="flex-end"><Button variant="default" onClick={onClose}>Hủy</Button><Button type="submit" loading={loading}>Lưu</Button></Group></Stack></form></Modal>
}

const CategoryModal = ({ editor, types, onClose, onSubmit, loading }: { editor: Extract<Editor, { kind: "category" }>; types: TaskTypeResponse[]; onClose: () => void; onSubmit: (value: TaskCategoryInput) => void; loading: boolean }) => {
  const form = useForm<TaskCategoryInput>({ initialValues: { taskTypeId: editor.value?.taskTypeId ?? types[0]?._id ?? "", name: editor.value?.name ?? "", description: editor.value?.description ?? "", active: editor.value?.active ?? true, sortOrder: editor.value?.sortOrder ?? 0, target: editor.value?.target ?? 0, unit: editor.value?.unit ?? "" }, validate: { taskTypeId: (value) => (value ? null : "Chọn loại task"), name: (value) => (value.trim() ? null : "Nhập tên phân loại") } })
  return <Modal opened onClose={onClose} title={editor.value ? "Sửa phân loại task" : "Thêm phân loại task"} centered><form onSubmit={form.onSubmit((value) => onSubmit({ ...value, name: value.name.trim(), description: value.description.trim(), unit: value.unit.trim() }))}><Stack><Select label="Loại task" withAsterisk data={types.map((type) => ({ value: type._id, label: type.name }))} {...form.getInputProps("taskTypeId")} /><TextInput label="Tên" withAsterisk {...form.getInputProps("name")} /><Textarea label="Mô tả" {...form.getInputProps("description")} /><Group grow><NumberInput label="Mục tiêu/tuần" min={0} {...form.getInputProps("target")} /><TextInput label="Đơn vị" placeholder="bài, video…" {...form.getInputProps("unit")} /></Group><NumberInput label="Thứ tự" min={0} {...form.getInputProps("sortOrder")} /><Switch label="Đang sử dụng" {...form.getInputProps("active", { type: "checkbox" })} /><Group justify="flex-end"><Button variant="default" onClick={onClose}>Hủy</Button><Button type="submit" loading={loading}>Lưu</Button></Group></Stack></form></Modal>
}
