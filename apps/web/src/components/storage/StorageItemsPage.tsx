import { useState } from "react"
import { useDebouncedValue } from "@mantine/hooks"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { modals } from "@mantine/modals"
import { useForm } from "@mantine/form"
import {
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  TextInput
} from "@mantine/core"
import { IconEdit, IconPlus, IconRestore, IconSearch, IconTrash } from "@tabler/icons-react"

import { CToast } from "../common/CToast"
import { useItems } from "../../hooks/useItems"
import type { CreateStorageItemRequest, SearchStorageItemResponse } from "../../hooks/models"
import { useAuthGuard } from "../../hooks/useAuthGuard"
import { hasAnyPermission } from "../../constants/navs"

const CREATE_PERMISSION = "api.storageitems.create-item"
const UPDATE_PERMISSION = "api.storageitems.update-item"
const DELETE_PERMISSION = "api.storageitems.delete-item"
const RESTORE_PERMISSION = "api.storageitems.restore-item"

export const StorageItemsPage = () => {
  const { meData } = useAuthGuard(["api.products.search-products", "api.storageitems.search-items"])
  const { searchStorageItems, createStorageItem, updateStorageItem, deleteStorageItem, restoreStorageItem } = useItems()
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText] = useDebouncedValue(searchText, 300)
  const [showDeleted, setShowDeleted] = useState(false)

  const itemsQuery = useQuery({
    queryKey: ["storage-items-page", debouncedSearchText, showDeleted],
    queryFn: () => searchStorageItems({ searchText: debouncedSearchText, deleted: showDeleted }),
    select: (response) => response.data
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["storage-items-page"] })
    void queryClient.invalidateQueries({ queryKey: ["searchStorageItems"] })
  }

  const createMutation = useMutation({
    mutationFn: createStorageItem,
    onSuccess: () => { CToast.success({ title: "Đã tạo Storage Item" }); modals.closeAll(); refresh() },
    onError: () => CToast.error({ title: "Không tạo được Storage Item" })
  })
  const updateMutation = useMutation({
    mutationFn: updateStorageItem,
    onSuccess: () => { CToast.success({ title: "Đã cập nhật Storage Item" }); modals.closeAll(); refresh() },
    onError: () => CToast.error({ title: "Không cập nhật được Storage Item" })
  })
  const deleteMutation = useMutation({
    mutationFn: deleteStorageItem,
    onSuccess: () => { CToast.success({ title: "Đã xóa Storage Item" }); refresh() },
    onError: () => CToast.error({ title: "Không xóa được Storage Item" })
  })
  const restoreMutation = useMutation({
    mutationFn: restoreStorageItem,
    onSuccess: () => { CToast.success({ title: "Đã khôi phục Storage Item" }); refresh() },
    onError: () => CToast.error({ title: "Không khôi phục được Storage Item" })
  })

  const permissions = meData?.permissions ?? []
  const canCreate = hasAnyPermission(permissions, [CREATE_PERMISSION])
  const canUpdate = hasAnyPermission(permissions, [UPDATE_PERMISSION])
  const canDelete = hasAnyPermission(permissions, [DELETE_PERMISSION])
  const canRestore = hasAnyPermission(permissions, [RESTORE_PERMISSION])

  const openForm = (item?: SearchStorageItemResponse) => {
    modals.open({
      title: item ? "Chỉnh sửa Storage Item" : "Tạo Storage Item",
      size: "md",
      zIndex: 500,
      children: <StorageItemForm item={item} onSubmit={(values) => {
        if (item) updateMutation.mutate({ _id: item._id, ...values })
        else createMutation.mutate(values)
      }} loading={createMutation.isPending || updateMutation.isPending} />
    })
  }

  const confirmDelete = (item: SearchStorageItemResponse) => {
    modals.openConfirmModal({
      title: "Xóa Storage Item?",
      children: <Text size="sm">“{item.name}” sẽ được chuyển sang danh sách đã xóa. SKU cũ vẫn giữ liên kết; item đã xóa sẽ không xuất hiện khi tạo hoặc sửa SKU.</Text>,
      labels: { confirm: "Xóa", cancel: "Hủy" },
      confirmProps: { color: "red", loading: deleteMutation.isPending },
      zIndex: 500,
      onConfirm: () => deleteMutation.mutate(item._id)
    })
  }

  const items = itemsQuery.data ?? []

  return (
    <Stack gap="lg" py="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={700} size="xl">Quản lý Storage Items</Text>
          <Text c="dimmed" size="sm" mt={4}>Danh mục mặt hàng dùng để cấu thành SKU. Trang này không theo dõi tồn kho.</Text>
        </div>
        {canCreate && !showDeleted && <Button leftSection={<IconPlus size={16} />} onClick={() => openForm()}>Thêm Storage Item</Button>}
      </Group>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="md" align="flex-end">
          <TextInput
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            placeholder="Tìm theo mã hoặc tên"
            w={{ base: "100%", sm: 340 }}
          />
          <Switch label="Hiện đã xóa" checked={showDeleted} onChange={(event) => setShowDeleted(event.currentTarget.checked)} />
        </Group>

        {itemsQuery.isLoading ? <Text c="dimmed">Đang tải Storage Items…</Text> : items.length === 0 ? <Text c="dimmed" ta="center" py="xl">Chưa có Storage Item nào.</Text> : (
          <Table.ScrollContainer minWidth={600}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Mã</Table.Th><Table.Th>Tên</Table.Th><Table.Th w={190}>Thao tác</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {items.map((item) => (
                  <Table.Tr key={item._id}>
                    <Table.Td>{item.code}</Table.Td>
                    <Table.Td>{item.name}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {showDeleted ? canRestore && <Button size="xs" variant="light" color="green" leftSection={<IconRestore size={14} />} onClick={() => restoreMutation.mutate({ id: item._id })}>Khôi phục</Button> : <>
                          {canUpdate && <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={() => openForm(item)}>Sửa</Button>}
                          {canDelete && <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={() => confirmDelete(item)}>Xóa</Button>}
                        </>}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        {!itemsQuery.isLoading && <Text size="xs" c="dimmed" mt="sm">{items.length} Storage Item{items.length === 1 ? "" : "s"}</Text>}
      </Paper>
    </Stack>
  )
}

function StorageItemForm({ item, onSubmit, loading }: {
  item?: SearchStorageItemResponse
  onSubmit: (values: Pick<CreateStorageItemRequest, "code" | "name">) => void
  loading: boolean
}) {
  const form = useForm<Pick<CreateStorageItemRequest, "code" | "name">>({
    initialValues: { code: item?.code ?? "", name: item?.name ?? "" },
    validate: {
      code: (value) => value.trim() ? null : "Nhập mã Storage Item",
      name: (value) => value.trim() ? null : "Nhập tên Storage Item"
    }
  })

  return (
    <form onSubmit={form.onSubmit((values) => onSubmit({ code: values.code.trim(), name: values.name.trim() }))}>
      <Stack>
        <TextInput label="Mã Storage Item" required autoFocus {...form.getInputProps("code")} />
        <TextInput label="Tên Storage Item" required {...form.getInputProps("name")} />
        <Group justify="flex-end" mt="sm"><Button type="submit" loading={loading}>{item ? "Lưu thay đổi" : "Tạo"}</Button></Group>
      </Stack>
    </form>
  )
}
