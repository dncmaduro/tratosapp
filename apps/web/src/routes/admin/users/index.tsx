import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core"
import { useForm } from "@mantine/form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Helmet } from "react-helmet-async"
import { modals } from "@mantine/modals"
import { AppLayout } from "../../../components/layouts/AppLayout"
import { CToast } from "../../../components/common/CToast"
import { ADMIN_NAVS } from "../../../constants/navs"
import { useAuthGuard } from "../../../hooks/useAuthGuard"
import type { AdminUserWriteRequest, PermissionResponse } from "../../../hooks/models"
import { useUsers } from "../../../hooks/useUsers"

export const Route = createFileRoute("/admin/users/")({ component: RouteComponent })

const PAGE_SIZE = 20
const navs = ADMIN_NAVS

const PERMISSION_GROUP_LABELS: Record<string, string> = {
  admin: "Quản trị tài khoản",
  "api.products": "Sản phẩm & SKU",
  "api.incomes": "Doanh thu",
  "api.dailyads": "Quảng cáo",
  "api.livestreammonthgoals": "Mục tiêu livestream",
  "api.packingrules": "Quy tắc đóng gói",
  "api.livestreamchannels": "Kênh livestream",
  "api.storageitems": "Kho hàng"
}

const PERMISSION_LABELS: Record<string, string> = {
  "admin.users.manage": "Quản lý tài khoản",
  "api.products.search-products": "Xem sản phẩm và SKU",
  "api.products.create-product": "Tạo sản phẩm",
  "api.products.update-product": "Chỉnh sửa sản phẩm",
  "api.products.delete-product": "Xóa sản phẩm",
  "api.products.restore-product": "Khôi phục sản phẩm",
  "api.products.cal-xlsx": "Tính dữ liệu từ Excel",
  "api.incomes.get-incomes-by-date-range": "Xem doanh thu",
  "api.incomes.insert-and-update-affiliate-type": "Phân loại affiliate",
  "api.incomes.delete-income-by-date": "Xóa doanh thu",
  "api.dailyads.upsert-daily-ads-metrics": "Ghi nhận và cập nhật ads",
  "api.dailyads.delete-daily-ads-metrics": "Xóa dữ liệu ads",
  "api.livestreammonthgoals.create-livestream-month-goal": "Tạo mục tiêu tháng",
  "api.livestreammonthgoals.update-livestream-month-goal": "Chỉnh sửa mục tiêu tháng",
  "api.packingrules.create-rule": "Tạo quy tắc đóng gói",
  "api.packingrules.update-rule": "Chỉnh sửa quy tắc đóng gói",
  "api.livestreamchannels.create-livestream-channel": "Tạo kênh livestream",
  "api.livestreamchannels.update-livestream-channel": "Chỉnh sửa kênh livestream",
  "api.livestreamchannels.delete-livestream-channel": "Xóa kênh livestream",
  "api.storageitems.create-item": "Tạo mặt hàng kho"
}

const groupPermissions = (permissions: PermissionResponse[]) => {
  const groups = new Map<string, { key: string; label: string; items: PermissionResponse[] }>()

  for (const permission of permissions) {
    const key = permission.key.startsWith("admin.")
      ? "admin"
      : permission.key.split(".").slice(0, 2).join(".")
    const group = groups.get(key) ?? {
      key,
      label: PERMISSION_GROUP_LABELS[key] ?? key,
      items: []
    }
    group.items.push(permission)
    groups.set(key, group)
  }

  return [...groups.values()]
}

function RouteComponent() {
  const { meData } = useAuthGuard(["admin.users.manage"])
  const { adminListUsers, adminCreateUser, adminUpdateUser, updateUserActive, listPermissions } = useUsers()
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [page, setPage] = useState(1)
  const [opened, setOpened] = useState(false)
  const [editingUser, setEditingUser] = useState<{ _id: string; username: string; name: string; permissions: string[] } | null>(null)

  const form = useForm<AdminUserWriteRequest>({
    initialValues: { email: "", name: "", password: "", permissions: [] },
    validate: {
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "Email không hợp lệ",
      name: (value) => value.trim() ? null : "Vui lòng nhập tên",
      password: (value) => !editingUser && (value ?? "").length < 8 ? "Mật khẩu cần ít nhất 8 ký tự" : value && value.length < 8 ? "Mật khẩu cần ít nhất 8 ký tự" : null
    }
  })

  const usersQuery = useQuery({
    queryKey: ["admin-users", searchText, page],
    queryFn: () => adminListUsers({ searchText, page, limit: PAGE_SIZE })
  })
  const permissionsQuery = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: listPermissions
  })

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  const createMutation = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: () => {
      CToast.success({ title: "Đã tạo tài khoản" })
      setOpened(false)
      refreshUsers()
    },
    onError: () => CToast.error({ title: "Không tạo được tài khoản" })
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserWriteRequest }) => adminUpdateUser(id, data),
    onSuccess: () => {
      CToast.success({ title: "Đã cập nhật tài khoản" })
      setOpened(false)
      refreshUsers()
    },
    onError: () => CToast.error({ title: "Không cập nhật được tài khoản" })
  })
  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateUserActive(id, { active }),
    onSuccess: (_response, variables) => {
      CToast.success({ title: variables.active ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản" })
      refreshUsers()
    },
    onError: () => CToast.error({ title: "Không cập nhật được trạng thái tài khoản" })
  })

  const openCreate = () => {
    setEditingUser(null)
    form.setValues({ email: "", name: "", password: "", permissions: [] })
    form.clearErrors()
    setOpened(true)
  }

  const openEdit = (user: NonNullable<typeof editingUser>) => {
    setEditingUser(user)
    form.setValues({ email: user.username, name: user.name, password: "", permissions: user.permissions })
    form.clearErrors()
    setOpened(true)
  }

  const submit = form.onSubmit((values) => {
    const data: AdminUserWriteRequest = {
      email: values.email.trim(),
      name: values.name.trim(),
      permissions: values.permissions,
      ...(values.password ? { password: values.password } : {})
    }
    if (editingUser) updateMutation.mutate({ id: editingUser._id, data })
    else createMutation.mutate({ ...data, password: values.password })
  })

  const confirmActiveChange = (user: NonNullable<typeof editingUser> & { active: boolean }) => {
    const active = !user.active
    modals.openConfirmModal({
      title: active ? "Mở khóa tài khoản?" : "Khóa tài khoản?",
      children: <Text size="sm">{active ? "Tài khoản này sẽ đăng nhập và sử dụng ứng dụng trở lại." : "Tài khoản này sẽ không thể đăng nhập cho đến khi được mở khóa."}</Text>,
      labels: { confirm: active ? "Mở khóa" : "Khóa tài khoản", cancel: "Hủy" },
      confirmProps: { color: active ? "blue" : "red" },
      onConfirm: () => activeMutation.mutate({ id: user._id, active })
    })
  }

  const users = usersQuery.data?.data.data ?? []
  const total = usersQuery.data?.data.total ?? 0
  const permissions = permissionsQuery.data?.data.data ?? []
  const permissionGroups = groupPermissions(permissions)
  const busy = createMutation.isPending || updateMutation.isPending
  const isEditingOwnAccount = editingUser?._id === meData?._id

  const updatePermissions = (keys: string[], checked: boolean) => {
    const selected = new Set(form.values.permissions)
    for (const key of keys) {
      if (checked) selected.add(key)
      else selected.delete(key)
    }
    form.setFieldValue("permissions", [...selected])
  }

  return (
    <>
      <Helmet><title>Quản lý tài khoản | Tratosapp</title></Helmet>
      <AppLayout navs={navs}>
        <Stack gap="lg" py="lg">
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={2}>Quản lý tài khoản</Title>
              <Text c="dimmed" size="sm" mt={4}>Tạo tài khoản, cập nhật thông tin và quyền truy cập.</Text>
            </div>
            <Button onClick={openCreate}>Tạo tài khoản</Button>
          </Group>

          <TextInput
            label="Tìm tài khoản"
            placeholder="Tìm theo tên hoặc email"
            value={searchText}
            onChange={(event) => { setSearchText(event.currentTarget.value); setPage(1) }}
          />

          {usersQuery.isError || permissionsQuery.isError ? <Alert color="red" title="Không tải được dữ liệu">Thử tải lại trang. Nếu lỗi tiếp tục, kiểm tra quyền quản lý tài khoản.</Alert> : null}
          {usersQuery.isLoading ? <Group justify="center" py="xl"><Loader /></Group> : (
            <>
              <Table.ScrollContainer minWidth={760}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr><Table.Th>Tên</Table.Th><Table.Th>Email</Table.Th><Table.Th>Quyền</Table.Th><Table.Th>Trạng thái</Table.Th><Table.Th>Thao tác</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {users.map((user) => (
                      <Table.Tr key={user._id}>
                        <Table.Td>{user.name}</Table.Td>
                        <Table.Td>{user.username}</Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {user.permissions.length ? user.permissions.slice(0, 2).map((permission) => <Badge key={permission} variant="light">{permission}</Badge>) : <Text c="dimmed" size="sm">Chưa cấp quyền</Text>}
                            {user.permissions.length > 2 ? <Badge variant="outline">+{user.permissions.length - 2}</Badge> : null}
                          </Group>
                        </Table.Td>
                        <Table.Td><Badge color={user.active ? "green" : "gray"}>{user.active ? "Hoạt động" : "Đã khóa"}</Badge></Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Button size="xs" variant="light" onClick={() => openEdit(user)}>Sửa</Button>
                            <Button
                              size="xs"
                              color={user.active ? "red" : "green"}
                              variant="subtle"
                              disabled={user._id === meData?._id || activeMutation.isPending}
                              onClick={() => confirmActiveChange(user)}
                            >{user.active ? "Khóa" : "Mở khóa"}</Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!users.length ? <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">Không tìm thấy tài khoản</Text></Table.Td></Table.Tr> : null}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">{total} tài khoản</Text>
                <Pagination total={Math.max(1, Math.ceil(total / PAGE_SIZE))} value={page} onChange={setPage} withEdges />
              </Group>
            </>
          )}
        </Stack>
      </AppLayout>

      <Modal opened={opened} onClose={() => setOpened(false)} title={editingUser ? "Chỉnh sửa tài khoản" : "Tạo tài khoản"} size="lg" zIndex={500}>
        <form onSubmit={submit}>
          <Stack>
            <TextInput label="Tên hiển thị" required {...form.getInputProps("name")} />
            <TextInput label="Email đăng nhập" type="email" required {...form.getInputProps("email")} />
            <PasswordInput
              label={editingUser ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
              required={!editingUser}
              autoComplete="new-password"
              {...form.getInputProps("password")}
            />
            <Stack gap="xs">
              <Text fw={600} size="sm">Quyền truy cập</Text>
              {permissionsQuery.isLoading ? <Text size="sm" c="dimmed">Đang tải danh sách quyền…</Text> : null}
              {!permissionsQuery.isLoading && !permissions.length ? <Text size="sm" c="dimmed">Chưa có quyền nào.</Text> : null}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {permissionGroups.map((group) => {
                  const keys = group.items.map((permission) => permission.key)
                  const selectedCount = keys.filter((key) => form.values.permissions.includes(key)).length
                  const allSelected = selectedCount === keys.length

                  return (
                    <Paper key={group.key} withBorder p="sm" radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between" gap="xs">
                          <Text fw={600} size="sm">{group.label}</Text>
                          <Text size="xs" c="dimmed">{selectedCount}/{keys.length}</Text>
                        </Group>
                        <Checkbox
                          label={allSelected ? "Bỏ chọn cả nhóm" : "Chọn cả nhóm"}
                          checked={allSelected}
                          indeterminate={selectedCount > 0 && !allSelected}
                          disabled={isEditingOwnAccount}
                          onChange={(event) => updatePermissions(keys, event.currentTarget.checked)}
                        />
                        <Stack gap={6} pl="xs">
                          {group.items.map((permission) => (
                            <Checkbox
                              key={permission.key}
                              value={permission.key}
                              label={PERMISSION_LABELS[permission.key] ?? permission.label}
                              checked={form.values.permissions.includes(permission.key)}
                              disabled={isEditingOwnAccount}
                              onChange={(event) => updatePermissions([permission.key], event.currentTarget.checked)}
                            />
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  )
                })}
              </SimpleGrid>
            </Stack>
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setOpened(false)}>Hủy</Button>
              <Button type="submit" loading={busy}>{editingUser ? "Lưu thay đổi" : "Tạo tài khoản"}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
