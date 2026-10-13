import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Group, NumberInput, Select, SimpleGrid, Stack, Text } from "@mantine/core"
import { DatePickerInput } from "@mantine/dates"
import { IconDeviceFloppy, IconInfoCircle } from "@tabler/icons-react"
import { modals } from "@mantine/modals"
import { useState } from "react"
import { useBookingMetrics } from "../../hooks/useBookingMetrics"
import type { BookingMetricType, UpsertBookingMetricsRequest } from "../../hooks/models"
import { CToast } from "../common/CToast"

type FormState = Omit<UpsertBookingMetricsRequest, "date" | "channelId">

const EMPTY_FORM: FormState = {
  type: "freecast",
  kocCount: 0,
  productShippingCost: 0,
  castFee: 0
}

const typeOptions = [
  { value: "freecast", label: "Freecast" },
  { value: "paid_cast", label: "Mất phí cast" }
]

const fieldStyles = {
  label: { color: "#0f172a", fontWeight: 600, marginBottom: 6 },
  input: { borderColor: "#cbd5e1", color: "#0f172a", fontWeight: 500 }
}

interface BookingMetricsModalProps {
  initialChannelId?: string | null
  initialDate?: Date | null
  initialType?: BookingMetricType
  initialData?: Partial<FormState> | null
  refetch?: () => void
}

export function BookingMetricsModal({
  initialChannelId = null,
  initialDate,
  initialType,
  initialData,
  refetch
}: BookingMetricsModalProps) {
  const queryClient = useQueryClient()
  const { upsertBookingMetrics } = useBookingMetrics()
  const isEditing = Boolean(initialDate && initialData)
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (initialDate) return initialDate
    const value = new Date()
    value.setDate(value.getDate() - 1)
    value.setHours(0, 0, 0, 0)
    return value
  })
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    ...(initialType ? { type: initialType } : {}),
    ...initialData
  })

  const { mutate: saveMetrics, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !initialChannelId) throw new Error("missing_required_values")
      return upsertBookingMetrics({
        date: selectedDate,
        channelId: initialChannelId,
        type: form.type,
        kocCount: form.kocCount,
        productShippingCost: form.productShippingCost,
        castFee: form.castFee
      })
    },
    onSuccess: async () => {
      CToast.success({ title: "Đã lưu chỉ số booking" })
      await queryClient.invalidateQueries({ queryKey: ["booking-metrics-list"] })
      refetch?.()
      modals.closeAll()
    },
    onError: () => CToast.error({ title: "Không lưu được chỉ số booking" })
  })

  const updateNumber = (key: keyof Omit<FormState, "type">, value: number | string) => {
    setForm((current) => ({ ...current, [key]: Number(value || 0) }))
  }

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Text fw={800} fz="lg" c="#0f172a">
          {isEditing ? "Cập nhật chỉ số booking theo ngày" : "Thêm chỉ số booking theo ngày"}
        </Text>
        <Text size="sm" c="#475569">
          Mỗi ngày có thể lưu riêng một báo cáo Freecast và một báo cáo Mất phí cast.
        </Text>
      </Stack>

      {!initialChannelId && (
        <Text size="sm" c="blue" bg="#eff6ff" p="sm" style={{ borderRadius: 12 }}>
          <IconInfoCircle size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Chọn kênh trước khi lưu chỉ số booking.
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Select
          label="Loại booking"
          data={typeOptions}
          value={form.type}
          onChange={(value) => setForm((current) => ({ ...current, type: (value ?? "freecast") as BookingMetricType }))}
          allowDeselect={false}
          disabled={isEditing}
          styles={fieldStyles}
        />
        <DatePickerInput
          label="Ngày báo cáo"
          value={selectedDate}
          onChange={setSelectedDate}
          valueFormat="DD/MM/YYYY"
          clearable={false}
          maxDate={new Date()}
          disabled={isEditing}
          styles={fieldStyles}
        />
        <NumberInput
          label="Số lượng KOC"
          value={form.kocCount}
          onChange={(value) => updateNumber("kocCount", value)}
          min={0}
          allowDecimal={false}
          thousandSeparator="."
          styles={fieldStyles}
        />
        <NumberInput
          label="Chi phí tiền hàng + ship"
          value={form.productShippingCost}
          onChange={(value) => updateNumber("productShippingCost", value)}
          min={0}
          thousandSeparator="."
          suffix=" đ"
          styles={fieldStyles}
        />
        <NumberInput
          label="Phí cast"
          value={form.castFee}
          onChange={(value) => updateNumber("castFee", value)}
          min={0}
          thousandSeparator="."
          suffix=" đ"
          styles={fieldStyles}
        />
      </SimpleGrid>

      <Group justify="flex-end">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => saveMetrics()}
          loading={isPending}
          disabled={!selectedDate || !initialChannelId}
        >
          Lưu báo cáo
        </Button>
      </Group>
    </Stack>
  )
}
