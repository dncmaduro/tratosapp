import { useMediaQuery } from "@mantine/hooks"
import type { GetMeResponse } from "../../hooks/models"
import { TASK_NAVS, getVisibleNavigationItems } from "../../constants/navs"
import { NavButton } from "./NavButton"
import { IconChevronLeft, IconMenu2 } from "@tabler/icons-react"

export const TaskSidebar = ({
  meData,
  collapsed,
  setCollapsed
}: {
  meData: GetMeResponse | undefined
  collapsed: boolean
  setCollapsed: (value: (previous: boolean) => boolean) => void
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const visibleNavs = getVisibleNavigationItems(TASK_NAVS, meData?.permissions ?? [])

  return (
    <nav
      className={[
        "sticky top-0 z-[201] h-screen border-r border-gray-200 bg-white",
        "flex flex-col shadow-[2px_0_18px_0_rgba(120,120,150,0.06)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "min-w-[240px]"
      ].join(" ")}
    >
      <button
        onClick={() => setCollapsed((value) => !value)}
        className={[
          "m-3 mb-2 rounded-lg bg-gray-100 p-1.5 hover:bg-gray-200",
          "transition-colors",
          collapsed ? "self-center" : "self-end"
        ].join(" ")}
        aria-label={collapsed ? "Mở menu công việc" : "Thu gọn menu công việc"}
      >
        {collapsed ? <IconMenu2 size={isMobile ? 14 : 22} /> : <IconChevronLeft size={isMobile ? 14 : 22} />}
      </button>
      <div className="border-b border-gray-100 px-4 pb-4">
        {!collapsed && (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Task workspace</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">Quản lý công việc</p>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-2 pt-4">
        {visibleNavs.map((nav) => (
          <NavButton key={nav.to} to={nav.to} label={nav.label} iconName={nav.icon} collapsed={collapsed} />
        ))}
      </div>
    </nav>
  )
}
