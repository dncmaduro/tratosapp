export const TIKTOKSHOP_NAVS_URL = "/tiktokshop"
export const NAVS_URL = TIKTOKSHOP_NAVS_URL
export const STORAGE_ACCESS_PERMISSIONS = ["api.products.search-products", "api.incomes.get-incomes-by-date-range"]

export type NavigationItem = { to: string; label: string; permissions: string[]; icon: string; deprecated?: boolean; beta?: boolean }

export const CHANNEL_MANAGEMENT_PERMISSIONS = [
  "api.livestreamchannels.create-livestream-channel",
  "api.livestreamchannels.update-livestream-channel",
  "api.livestreamchannels.delete-livestream-channel"
]

export const TIKTOKSHOP_ACCESS_PERMISSIONS = [
  "api.products.search-products",
  "api.incomes.get-incomes-by-date-range"
]

export const TIKTOKSHOP_APP_ACCESS_PERMISSIONS = [
  ...TIKTOKSHOP_ACCESS_PERMISSIONS,
  ...CHANNEL_MANAGEMENT_PERMISSIONS
]

export const TIKTOKSHOP_NAVS: NavigationItem[] = [
  { to: `${TIKTOKSHOP_NAVS_URL}/sku`, label: "SKU", icon: "IconBox", permissions: ["api.products.search-products"] },
  { to: `${TIKTOKSHOP_NAVS_URL}/incomes`, label: "Doanh thu", icon: "IconCoin", permissions: ["api.incomes.get-incomes-by-date-range"] },
  { to: `${TIKTOKSHOP_NAVS_URL}/channels`, label: "Quản lý kênh", icon: "IconUsers", permissions: CHANNEL_MANAGEMENT_PERMISSIONS }
]

export const NAVS = TIKTOKSHOP_NAVS

export const hasAnyPermission = (userPermissions: string[] = [], required: string[] = []) =>
  required.length === 0 || userPermissions.includes("*") || required.some((permission) => userPermissions.includes(permission))

export const getVisibleNavigationItems = <T extends NavigationItem>(navs: T[], permissions: string[] = []) =>
  navs.filter((nav) => !nav.deprecated && hasAnyPermission(permissions, nav.permissions))

export const getStorageAppBasePath = (_pathname?: string) => TIKTOKSHOP_NAVS_URL
export const getStorageNavsByPath = () => TIKTOKSHOP_NAVS

// Temporary compatibility exports retained for shared source files. They are
// not exposed by the Tratosapp route tree.
export const SHOPEE_NAVS: NavigationItem[] = []
export const SHOPEE_ACCESS_PERMISSIONS: string[] = []
export const LANDING_NAVS: NavigationItem[] = []
export const LIVESTREAM_NAVS: NavigationItem[] = []
export const SALES_NAVS: NavigationItem[] = []
export const SALES_ACCESS_PERMISSIONS: string[] = []
export const ADMIN_NAVS: NavigationItem[] = [
  { to: "/admin/users", label: "Quản lý tài khoản", icon: "IconSquareRounded", permissions: ["admin.users.manage"] }
]
export const canAccessSalesRoute = (_permissions?: string[], _pathname?: string) => false
