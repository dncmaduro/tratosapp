import {
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput
} from "@mantine/core"
import { useDebouncedValue } from "@mantine/hooks"
import { modals } from "@mantine/modals"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Helmet } from "react-helmet-async"
import { IconPlus, IconSearch, IconPencil, IconTrash } from "@tabler/icons-react"
import { AppLayout } from "../../../components/layouts/AppLayout"
import { CToast } from "../../../components/common/CToast"
import { LivestreamChannelModal } from "../../../components/livestream/LivestreamChannelModal"
import { CHANNEL_MANAGEMENT_PERMISSIONS, TIKTOKSHOP_NAVS, hasAnyPermission } from "../../../constants/navs"
import { useAuthGuard } from "../../../hooks/useAuthGuard"
import { useLivestreamChannels } from "../../../hooks/useLivestreamChannels"
import type { LivestreamChannel } from "../../../hooks/models"

export const Route = createFileRoute("/tiktokshop/channels/")({ component: RouteComponent })

const PAGE_SIZE = 50
const CREATE_CHANNEL_PERMISSION = "api.livestreamchannels.create-livestream-channel"
const UPDATE_CHANNEL_PERMISSION = "api.livestreamchannels.update-livestream-channel"
const DELETE_CHANNEL_PERMISSION = "api.livestreamchannels.delete-livestream-channel"

function RouteComponent() {
  const { meData } = useAuthGuard(CHANNEL_MANAGEMENT_PERMISSIONS)
  const { searchLivestreamChannels, deleteLivestreamChannel } = useLivestreamChannels()
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText] = useDebouncedValue(searchText, 300)
  const [page, setPage] = useState(1)

  const channelsQuery = useQuery({
    queryKey: ["tiktokshop-channels", debouncedSearchText, page],
    queryFn: () => searchLivestreamChannels({
      platform: "tiktokshop",
      searchText: debouncedSearchText,
      page,
      limit: PAGE_SIZE
    }),
    select: (response) => response.data
  })

  const refreshChannels = () => {
    void queryClient.invalidateQueries({ queryKey: ["tiktokshop-channels"] })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteLivestreamChannel,
    onSuccess: () => {
      CToast.success({ title: "Đã xóa kênh" })
      refreshChannels()
    },
    onError: () => CToast.error({ title: "Không xóa được kênh" })
  })

  const channels = channelsQuery.data?.data ?? []
  const total = channelsQuery.data?.total ?? 0
  const permissions = meData?.permissions ?? []
  const canCreate = hasAnyPermission(permissions, [CREATE_CHANNEL_PERMISSION])
  const canUpdate = hasAnyPermission(permissions, [UPDATE_CHANNEL_PERMISSION])
  const canDelete = hasAnyPermission(permissions, [DELETE_CHANNEL_PERMISSION])

  const openChannelForm = (channel?: LivestreamChannel) => {
    modals.open({
      title: channel ? "Chỉnh sửa kênh TikTok Shop" : "Tạo kênh TikTok Shop",
      size: "md",
      zIndex: 500,
      children: <LivestreamChannelModal channel={channel} refetch={refreshChannels} />
    })
  }

  const confirmDelete = (channel: LivestreamChannel) => {
    modals.openConfirmModal({
      title: "Xóa kênh TikTok Shop?",
      children: (
        <Text size="sm">
          Kênh “{channel.name}” sẽ bị xóa vĩnh viễn. Các đơn doanh thu đã liên kết với kênh này có thể không còn hiển thị đúng tên kênh.
        </Text>
      ),
      labels: { confirm: "Xóa kênh", cancel: "Hủy" },
      confirmProps: { color: "red", loading: deleteMutation.isPending },
      zIndex: 500,
      onConfirm: () => deleteMutation.mutate({ id: channel._id })
    })
  }

  return (
    <>
      <Helmet><title>Quản lý kênh TikTok Shop | Tratosapp</title></Helmet>
      <AppLayout navs={TIKTOKSHOP_NAVS}>
        <Stack gap="lg" py="lg">
          <Group justify="space-between" align="flex-end">
            <div>
              <Text fw={700} size="xl">Quản lý kênh TikTok Shop</Text>
              <Text c="dimmed" size="sm" mt={4}>Kênh dùng để tách doanh thu và dữ liệu quảng cáo.</Text>
            </div>
            {canCreate && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => openChannelForm()}>
                Tạo kênh
              </Button>
            )}
          </Group>

          <TextInput
            leftSection={<IconSearch size={16} />}
            placeholder="Tìm theo tên kênh hoặc username"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.currentTarget.value)
              setPage(1)
            }}
          />

          {channelsQuery.isError ? (
            <Alert color="red" title="Không tải được danh sách kênh">Thử tải lại trang.</Alert>
          ) : channelsQuery.isLoading ? (
            <Group justify="center" py="xl"><Loader /></Group>
          ) : (
            <Paper withBorder radius="md" p={0}>
              <Table.ScrollContainer minWidth={720}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Tên kênh</Table.Th>
                      <Table.Th>Username</Table.Th>
                      <Table.Th>Link</Table.Th>
                      <Table.Th>Thao tác</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {channels.map((channel) => (
                      <Table.Tr key={channel._id}>
                        <Table.Td>{channel.name}</Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">@{channel.username}</Text>
                            {channel.usernames?.filter((username) => username !== channel.username).map((username) => (
                              <Text key={username} size="xs" c="dimmed">@{username}</Text>
                            ))}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          {channel.link ? (
                            <Anchor href={channel.link} target="_blank" rel="noreferrer" size="sm">Mở kênh</Anchor>
                          ) : <Text size="sm" c="dimmed">—</Text>}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            {canUpdate && (
                              <Button size="xs" variant="light" leftSection={<IconPencil size={14} />} onClick={() => openChannelForm(channel)}>
                                Sửa
                              </Button>
                            )}
                            {canDelete && (
                              <Button size="xs" color="red" variant="subtle" leftSection={<IconTrash size={14} />} loading={deleteMutation.isPending} onClick={() => confirmDelete(channel)}>
                                Xóa
                              </Button>
                            )}
                            {!canUpdate && !canDelete ? <Text size="sm" c="dimmed">—</Text> : null}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {!channels.length ? (
                      <Table.Tr><Table.Td colSpan={4}><Text ta="center" c="dimmed" py="md">Chưa có kênh TikTok Shop nào.</Text></Table.Td></Table.Tr>
                    ) : null}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          )}

          <Group justify="space-between">
            <Text size="sm" c="dimmed">{total} kênh</Text>
            <Pagination total={Math.max(1, Math.ceil(total / PAGE_SIZE))} value={page} onChange={setPage} withEdges />
          </Group>
        </Stack>
      </AppLayout>
    </>
  )
}
