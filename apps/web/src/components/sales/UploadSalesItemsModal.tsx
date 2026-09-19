import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button, FileButton, Group, Stack, Text, Divider } from "@mantine/core"
import {
  IconFileSpreadsheet,
  IconUpload,
  IconDownload
} from "@tabler/icons-react"
import { useSalesItems } from "../../hooks/useSalesItems"
import { CToast } from "../common/CToast"

interface UploadSalesItemsModalProps {
  onSuccess: () => void
}

export const UploadSalesItemsModal = ({
  onSuccess
}: UploadSalesItemsModalProps) => {
  const { uploadSalesItems, downloadSalesItemsTemplate } = useSalesItems()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { mutate: uploadFile, isPending: uploading } = useMutation({
    mutationFn: (file: File) => uploadSalesItems(file),
    onSuccess: () => {
      CToast.success({
        title: "Upload thành công - Dữ liệu sản phẩm đã được import"
      })
      onSuccess()
    },
    onError: (error: any) => {
      CToast.error({
        title: error?.response?.data?.message || "Có lỗi xảy ra khi upload file"
      })
    }
  })

  const { mutate: downloadTemplate, isPending: isDownloading } = useMutation({
    mutationFn: () => downloadSalesItemsTemplate(),
    onSuccess: (response) => {
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `sales-items-template-${new Date().getTime()}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      CToast.success({
        title: "Đã tải xuống template thành công"
      })
    },
    onError: () => {
      CToast.error({
        title: "Có lỗi xảy ra khi tải template"
      })
    }
  })

  const handleUpload = () => {
    if (!selectedFile) {
      CToast.error({
        title: "Vui lòng chọn file XLSX để upload"
      })
      return
    }

    uploadFile(selectedFile)
  }

  const handleDownloadTemplate = () => {
    downloadTemplate()
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Upload file Excel (.xlsx) để import danh sách sản phẩm. File cần có các
        cột: Mã SP, Tên (Tiếng Việt), Tên (Tiếng Trung), Nhà máy, Nguồn, Giá,
        Quy cách, v.v.
      </Text>

      {/* Download Template Section */}
      <Button
        leftSection={<IconDownload size={16} />}
        onClick={handleDownloadTemplate}
        loading={isDownloading}
        variant="outline"
        fullWidth
      >
        Tải template mẫu
      </Button>

      <Divider label="Hoặc" labelPosition="center" />

      {/* Upload Section */}
      <FileButton
        onChange={setSelectedFile}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      >
        {(props) => (
          <Button
            {...props}
            leftSection={<IconFileSpreadsheet size={16} />}
            variant="light"
            fullWidth
          >
            {selectedFile ? selectedFile.name : "Chọn file XLSX"}
          </Button>
        )}
      </FileButton>

      {selectedFile && (
        <Text size="sm" c="dimmed">
          Đã chọn: <strong>{selectedFile.name}</strong> (
          {(selectedFile.size / 1024).toFixed(2)} KB)
        </Text>
      )}

      <Group justify="flex-end" mt="md">
        <Button
          leftSection={<IconUpload size={16} />}
          onClick={handleUpload}
          loading={uploading}
          disabled={!selectedFile}
        >
          Upload
        </Button>
      </Group>
    </Stack>
  )
}
