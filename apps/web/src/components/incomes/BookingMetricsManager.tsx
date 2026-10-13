import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ColumnDef } from "@tanstack/react-table"
import { eachDayOfInterval, format, subDays } from "date-fns"
import { modals } from "@mantine/modals"
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text
} from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { useLivestreamChannel } from "../../context/LivestreamChannelContext"
import type {
  BookingMetricType,
  BookingMetricsResponse,
  DeleteBookingMetricsRequest,
  UpsertBookingMetricsRequest
} from "../../hooks/models"
import { useBookingMetrics } from "../../hooks/useBookingMetrics"
import { Can } from "../common/Can"
import { CDataTable } from "../common/CDataTable"
import { CToast } from "../common/CToast"
import { BookingMetricsModal } from "./BookingMetricsModal"

const CREATE_PERMISSION = "api.dailybooking.upsert-daily-booking-metrics"
const DELETE_PERMISSION = "api.dailybooking.delete-daily-booking-metrics"
const formatCurrency = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")}đ`
const formatType = (type: BookingMetricType) => type === "freecast" ? "Freecast" : "Mất phí cast"
const normalizeDate = (value: Date) => {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}
const toDateKey = (value: Date) => format(normalizeDate(value), "yyyy-MM-dd")

const buildInitialData = (row: BookingMetricsResponse): Partial<UpsertBookingMetricsRequest> => ({
  type: row.type,
  kocCount: row.kocCount,
  productShippingCost: row.productShippingCost,
  castFee: row.castFee
})

export function BookingMetricsManager() {
  const queryClient = useQueryClient()
  const { selectedChannelId, channels, setSelectedChannelId } = useLivestreamChannel()
  const { getBookingMetrics, deleteBookingMetrics } = useBookingMetrics()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [startDate, setStartDate] = useState<Date | null>(() => subDays(new Date(), 30))
  const [endDate, setEndDate] = useState<Date | null>(new Date())

  const daysInRange = useMemo(() => {
    if (!startDate || !endDate) return []
    const start = normalizeDate(startDate)
    const end = normalizeDate(endDate)
    return start > end ? [] : eachDayOfInterval({ start, end })
  }, [endDate, startDate])

  const {
    data: metricsRows = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [
      "booking-metrics-list",
      selectedChannelId,
      startDate ? toDateKey(startDate) : null,
      endDate ? toDateKey(endDate) : null
    ],
    queryFn: async () => {
      if (!selectedChannelId || daysInRange.length === 0 || !startDate || !endDate) return []
      const response = await getBookingMetrics({
        channelId: selectedChannelId,
        fromDate: startDate,
        toDate: endDate
      })
      return response.data.data
    },
    enabled: Boolean(selectedChannelId && daysInRange.length > 0)
  })

  const { mutate: deleteMetrics, isPending: isDeleting } = useMutation({
    mutationFn: (req: DeleteBookingMetricsRequest) => deleteBookingMetrics(req),
    onSuccess: async (_, args) => {
      CToast.success({ title: `Đã xóa báo cáo booking ngày ${format(args.date, "dd/MM/yyyy")}` })
      await queryClient.invalidateQueries({ queryKey: ["booking-metrics-list"] })
    },
    onError: (mutationError) => CToast.error({
      title: "Xóa báo cáo thất bại",
      subtitle: mutationError.message || "Vui lòng thử lại"
    })
  })

  const totalPages = Math.max(1, Math.ceil(metricsRows.length / limit))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => metricsRows.slice((currentPage - 1) * limit, currentPage * limit), [currentPage, limit, metricsRows])
  const summary = useMemo(() => metricsRows.reduce((total, row) => ({
    kocCount: total.kocCount + Number(row.kocCount || 0),
    productShippingCost: total.productShippingCost + Number(row.productShippingCost || 0),
    castFee: total.castFee + Number(row.castFee || 0)
  }), { kocCount: 0, productShippingCost: 0, castFee: 0 }), [metricsRows])

  const openCreateModal = () => {
    modals.open({
      title: <b>Thêm chỉ số booking theo ngày</b>,
      children: <BookingMetricsModal initialChannelId={selectedChannelId} refetch={() => void refetch()} />,
      size: 720
    })
  }

  const openEditModal = useCallback((row: BookingMetricsResponse) => {
    modals.open({
      title: <b>Cập nhật chỉ số booking theo ngày</b>,
      children: (
        <BookingMetricsModal
          initialChannelId={selectedChannelId}
          initialDate={new Date(row.date)}
          initialType={row.type}
          initialData={buildInitialData(row)}
          refetch={() => void refetch()}
        />
      ),
      size: 720
    })
  }, [refetch, selectedChannelId])

  const openDeleteConfirmModal = useCallback((row: BookingMetricsResponse) => {
    modals.openConfirmModal({
      title: <b>Xác nhận xóa báo cáo booking</b>,
      children: <Text size="sm">Bạn có chắc muốn xóa báo cáo <strong>{formatType(row.type)}</strong> ngày <strong>{format(new Date(row.date), "dd/MM/yyyy")}</strong> không?</Text>,
      labels: { confirm: "Xóa", cancel: "Hủy" },
      confirmProps: { color: "red", loading: isDeleting },
      onConfirm: () => deleteMetrics({ date: new Date(row.date), channelId: row.channel, type: row.type })
    })
  }, [deleteMetrics, isDeleting])

  const columns = useMemo<ColumnDef<BookingMetricsResponse>[]>(() => [
    {
      accessorKey: "date",
      header: "Ngày",
      size: 120,
      cell: ({ row }) => <Text size="sm" fw={600}>{format(new Date(row.original.date), "dd/MM/yyyy")}</Text>
    },
    {
      accessorKey: "type",
      header: "Loại booking",
      size: 150,
      cell: ({ row }) => <Badge color={row.original.type === "freecast" ? "teal" : "violet"} variant="light">{formatType(row.original.type)}</Badge>
    },
    {
      accessorKey: "kocCount",
      header: "Số KOC",
      size: 110,
      cell: ({ row }) => <Text size="sm">{Number(row.original.kocCount || 0).toLocaleString("vi-VN")}</Text>
    },
    {
      accessorKey: "productShippingCost",
      header: "Tiền hàng + ship",
      size: 170,
      cell: ({ row }) => <Text size="sm">{formatCurrency(row.original.productShippingCost)}</Text>
    },
    {
      accessorKey: "castFee",
      header: "Phí cast",
      size: 150,
      cell: ({ row }) => <Text size="sm">{formatCurrency(row.original.castFee)}</Text>
    },
    {
      id: "totalCost",
      header: "Tổng chi phí",
      size: 170,
      cell: ({ row }) => <Text size="sm" fw={700}>{formatCurrency(Number(row.original.productShippingCost || 0) + Number(row.original.castFee || 0))}</Text>
    },
    {
      accessorKey: "updatedAt",
      header: "Cập nhật",
      size: 170,
      cell: ({ row }) => <Text size="sm" c="dimmed">{row.original.updatedAt ? format(new Date(row.original.updatedAt), "dd/MM/yyyy HH:mm") : "-"}</Text>
    },
    {
      id: "actions",
      header: "",
      size: 150,
      cell: ({ row }) => (
        <Flex gap={4}>
          <Can permissions={[CREATE_PERMISSION]}><Button size="xs" variant="light" leftSection={<IconPencil size={14} />} onClick={() => openEditModal(row.original)}>Sửa</Button></Can>
          <Can permissions={[DELETE_PERMISSION]}><Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} disabled={isDeleting} onClick={() => openDeleteConfirmModal(row.original)}>Xóa</Button></Can>
        </Flex>
      )
    }
  ], [isDeleting, openDeleteConfirmModal, openEditModal])

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="xl">
        <Stack gap="xs">
          <Text fw={700} fz="lg">Chỉ số booking qua các ngày</Text>
          <Text size="sm" c="dimmed">Theo dõi số KOC và chi phí booking theo từng loại Freecast hoặc Mất phí cast.</Text>
          <Divider />

          {!selectedChannelId && <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />} radius="xl">Cần chọn kênh ở phần bên trên trước khi xem báo cáo booking.</Alert>}
          {error && <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} radius="xl">Không tải được danh sách báo cáo booking. Bấm Làm mới để thử lại.</Alert>}

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="sm">
            <Paper withBorder p="md" radius="lg" bg="#f8fafc"><Text size="xs" c="dimmed">Tổng KOC</Text><Text fw={800} size="xl">{summary.kocCount.toLocaleString("vi-VN")}</Text></Paper>
            <Paper withBorder p="md" radius="lg" bg="#f8fafc"><Text size="xs" c="dimmed">Tiền hàng + ship</Text><Text fw={800} size="xl">{formatCurrency(summary.productShippingCost)}</Text></Paper>
            <Paper withBorder p="md" radius="lg" bg="#f8fafc"><Text size="xs" c="dimmed">Phí cast</Text><Text fw={800} size="xl">{formatCurrency(summary.castFee)}</Text></Paper>
          </SimpleGrid>

          <Box mt="sm">
            <CDataTable
              columns={columns}
              data={pagedRows}
              isLoading={isLoading}
              hideSearch
              hideColumnToggle
              page={currentPage}
              totalPages={totalPages}
              initialPageSize={limit}
              onPageChange={setPage}
              onPageSizeChange={(value) => { setLimit(value); setPage(1) }}
              extraFilters={
                <>
                  <Select
                    label="Kênh"
                    value={selectedChannelId}
                    onChange={(value) => { setSelectedChannelId?.(value ?? null); setPage(1) }}
                    data={channels.map((channel) => ({ label: channel.name, value: channel._id }))}
                    placeholder="Chọn kênh"
                    searchable
                    clearable={false}
                    size="sm"
                    radius="md"
                    style={{ width: 240 }}
                  />
                  <DatePickerInput label="Từ ngày" value={startDate} onChange={(value) => { setStartDate(value); setPage(1) }} valueFormat="DD/MM/YYYY" clearable={false} maxDate={endDate ?? new Date()} size="sm" radius="md" style={{ width: 160 }} />
                  <DatePickerInput label="Đến ngày" value={endDate} onChange={(value) => { setEndDate(value); setPage(1) }} valueFormat="DD/MM/YYYY" clearable={false} minDate={startDate ?? undefined} maxDate={new Date()} size="sm" radius="md" style={{ width: 160 }} />
                </>
              }
              extraActions={
                <Group gap="sm">
                  <Button size="sm" radius="md" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => void refetch()}>Làm mới</Button>
                  <Can permissions={[CREATE_PERMISSION]}><Button size="sm" radius="md" leftSection={<IconPlus size={16} />} onClick={openCreateModal} disabled={!selectedChannelId}>Tạo booking mới</Button></Can>
                </Group>
              }
              emptyState={<Text c="dimmed" size="sm">{error ? "Không tải được dữ liệu." : "Chưa có báo cáo booking nào trong khoảng ngày đang chọn."}</Text>}
            />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  )
}
