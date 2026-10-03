import { Avatar, Box, Group, Menu, Stack, Text } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import {
  IconBrandTiktok,
  IconPower,
  IconSettings,
  IconUser
} from "@tabler/icons-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useUserStore } from "../../store/userStore"
import { useUsers } from "../../hooks/useUsers"
import {
  ADMIN_NAVS,
  hasAnyPermission,
  TIKTOKSHOP_APP_ACCESS_PERMISSIONS,
  TIKTOKSHOP_NAVS
} from "../../constants/navs"
import { resetSessionCache } from "../../utils/authSession"

export const UserMenu = () => {
  const { accessToken, clearUser } = useUserStore()
  const { getMe } = useUsers()
  const queryClient = useQueryClient()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const { data: meData } = useQuery({
    queryKey: ["getMe"],
    queryFn: getMe,
    enabled: !!accessToken,
    select: (data) => data.data
  })
  const permissions = meData?.permissions ?? []
  const canOpenTikTokShop = hasAnyPermission(permissions, TIKTOKSHOP_APP_ACCESS_PERMISSIONS)
  const canOpenAdmin = hasAnyPermission(permissions, ["admin.users.manage"])
  const firstTikTokShopPage = TIKTOKSHOP_NAVS.find((nav) =>
    hasAnyPermission(permissions, nav.permissions)
  )?.to ?? "/tiktokshop/sku"
  const adminPage = ADMIN_NAVS[0]?.to ?? "/admin/users"

  return (
    <Menu shadow="xl" withArrow position="bottom-end" offset={isMobile ? 2 : 8}>
      <Menu.Target>
        <Group
          gap={10}
          className="cursor-pointer select-none"
          px={10}
          py={4}
          style={{
            borderRadius: 24,
            background: "rgba(245,246,250,0.9)",
            border: "1px solid #ececec",
            transition: "box-shadow 0.2s",
            boxShadow: "0 2px 8px 0 rgba(60, 60, 80, 0.06)"
          }}
        >
          <Avatar
            size={isMobile ? 24 : "sm"}
            radius="xl"
            alt={meData?.name}
            src={meData?.avatarUrl}
          />
          <Text fw={500} fz={isMobile ? "xs" : "sm"} lh={isMobile ? 1 : 1.2}>
            {meData?.name ?? "Người dùng"}
          </Text>
        </Group>
      </Menu.Target>

      <Menu.Dropdown px={0} py={0} style={{ minWidth: isMobile ? 200 : 230 }}>
        <Box p="md" bg="gray.0" mb={6}>
          <Stack gap={4} align="center">
            <Avatar
              size={isMobile ? 40 : 54}
              radius={32}
              src={meData?.avatarUrl}
              alt={meData?.name}
              style={{ border: "2px solid #ececec" }}
            />
            <Text fw={600} fz={isMobile ? "sm" : "md"}>
              {meData?.name ?? "Người dùng"}
            </Text>
          </Stack>
        </Box>

        <Menu.Label fz={isMobile ? "11" : "sm"}>Các ứng dụng</Menu.Label>
        <Menu.Item
          leftSection={<IconBrandTiktok size={isMobile ? 14 : 18} />}
          fz={isMobile ? "xs" : "sm"}
          component={Link}
          to={firstTikTokShopPage as never}
          hidden={!canOpenTikTokShop}
        >
          TikTok Shop
        </Menu.Item>
        <Menu.Item
          leftSection={<IconSettings size={isMobile ? 14 : 18} />}
          fz={isMobile ? "xs" : "sm"}
          component={Link}
          to={adminPage as never}
          hidden={!canOpenAdmin}
        >
          Quản trị
        </Menu.Item>

        <Menu.Divider my={0} />
        <Menu.Label fz={isMobile ? "11" : "sm"}>Tài khoản</Menu.Label>
        <Menu.Item
          leftSection={<IconUser size={isMobile ? 14 : 18} />}
          fz={isMobile ? "xs" : "sm"}
          disabled
        >
          {meData?.username ?? "Tài khoản Tratosapp"}
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPower size={isMobile ? 14 : 18} />}
          color="red"
          fz={isMobile ? "xs" : "sm"}
          onClick={() => {
            resetSessionCache(queryClient)
            clearUser()
          }}
        >
          Đăng xuất
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
