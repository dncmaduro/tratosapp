import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { hasAnyPermission, TIKTOKSHOP_APP_ACCESS_PERMISSIONS, TIKTOKSHOP_NAVS } from "../../constants/navs"
import { useAuthGuard } from "../../hooks/useAuthGuard"

export const Route = createFileRoute("/tiktokshop/")({
  component: RouteComponent
})

function RouteComponent() {
  const navigate = useNavigate()
  const { meData } = useAuthGuard(TIKTOKSHOP_APP_ACCESS_PERMISSIONS)

  useEffect(() => {
    if (!meData) return
    const destination = TIKTOKSHOP_NAVS.find((nav) =>
      hasAnyPermission(meData.permissions, nav.permissions)
    )?.to
    if (destination) navigate({ to: destination as never })
  }, [meData, navigate])

  return null
}
