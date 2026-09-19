import { Avatar, Group, Menu, Text } from "@mantine/core"
import { IconPower } from "@tabler/icons-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useUserStore } from "../../store/userStore"
import { useUsers } from "../../hooks/useUsers"
import { resetSessionCache } from "../../utils/authSession"

export const UserMenu = () => {
  const { accessToken, clearUser } = useUserStore()
  const { getMe } = useUsers()
  const queryClient = useQueryClient()
  const { data: meData } = useQuery({ queryKey: ["getMe"], queryFn: getMe, enabled: !!accessToken, select: (data) => data.data })

  return <Menu shadow="xl" withArrow position="bottom-end">
    <Menu.Target><Group gap={10} px={10} py={4} style={{ borderRadius: 24, background: "#f5f6fa", cursor: "pointer" }}>
      <Avatar size="sm" radius="xl" src={meData?.avatarUrl} />
      <Text fw={500} size="sm">{meData?.name ?? "Người dùng"}</Text>
    </Group></Menu.Target>
    <Menu.Dropdown><Menu.Item leftSection={<IconPower size={16} />} color="red" onClick={() => { resetSessionCache(queryClient); clearUser() }}>Đăng xuất</Menu.Item></Menu.Dropdown>
  </Menu>
}
