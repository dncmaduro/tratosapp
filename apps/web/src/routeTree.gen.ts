/* This app owns an explicit TikTok-only route tree. */
/* eslint-disable */
// @ts-nocheck
import { Route as rootRoute } from "./routes/__root"
import { Route as loginRoute } from "./routes/index"
import { Route as accessDeniedRoute } from "./routes/access-denied/index"
import { Route as tiktokshopRoute } from "./routes/tiktokshop/index"
import { Route as skuRoute } from "./routes/tiktokshop/sku/index"
import { Route as incomesRoute } from "./routes/tiktokshop/incomes/index"
import { Route as incomeDetailRoute } from "./routes/tiktokshop/incomes/$incomeId"

const login = loginRoute.update({
  id: "/",
  path: "/",
  getParentRoute: () => rootRoute
} as never)

const accessDenied = accessDeniedRoute.update({
  id: "/access-denied/",
  path: "/access-denied/",
  getParentRoute: () => rootRoute
} as never)

const tiktokshop = tiktokshopRoute.update({
  id: "/tiktokshop/",
  path: "/tiktokshop/",
  getParentRoute: () => rootRoute
} as never)

const sku = skuRoute.update({
  id: "/tiktokshop/sku/",
  path: "/tiktokshop/sku/",
  getParentRoute: () => rootRoute
} as never)

const incomes = incomesRoute.update({
  id: "/tiktokshop/incomes/",
  path: "/tiktokshop/incomes/",
  getParentRoute: () => rootRoute
} as never)

const incomeDetail = incomeDetailRoute.update({
  id: "/tiktokshop/incomes/$incomeId",
  path: "/tiktokshop/incomes/$incomeId",
  getParentRoute: () => rootRoute
} as never)

export const routeTree = rootRoute.addChildren([
  login,
  accessDenied,
  tiktokshop.addChildren([sku, incomes, incomeDetail])
])

declare module "@tanstack/react-router" {
  interface FileRoutesByPath {
    "/": { id: "/"; path: "/"; fullPath: "/"; preLoaderRoute: typeof loginRoute; parentRoute: typeof rootRoute }
    "/access-denied/": { id: "/access-denied/"; path: "/access-denied"; fullPath: "/access-denied"; preLoaderRoute: typeof accessDeniedRoute; parentRoute: typeof rootRoute }
    "/tiktokshop/": { id: "/tiktokshop/"; path: "/tiktokshop"; fullPath: "/tiktokshop"; preLoaderRoute: typeof tiktokshopRoute; parentRoute: typeof rootRoute }
    "/tiktokshop/sku/": { id: "/tiktokshop/sku/"; path: "/tiktokshop/sku"; fullPath: "/tiktokshop/sku"; preLoaderRoute: typeof skuRoute; parentRoute: typeof rootRoute }
    "/tiktokshop/incomes/": { id: "/tiktokshop/incomes/"; path: "/tiktokshop/incomes"; fullPath: "/tiktokshop/incomes"; preLoaderRoute: typeof incomesRoute; parentRoute: typeof rootRoute }
    "/tiktokshop/incomes/$incomeId": { id: "/tiktokshop/incomes/$incomeId"; path: "/tiktokshop/incomes/$incomeId"; fullPath: "/tiktokshop/incomes/$incomeId"; preLoaderRoute: typeof incomeDetailRoute; parentRoute: typeof rootRoute }
    "/marketing-storage/incomes/": { id: "/marketing-storage/incomes/"; path: "/marketing-storage/incomes"; fullPath: "/marketing-storage/incomes"; preLoaderRoute: typeof incomesRoute; parentRoute: typeof rootRoute }
    "/marketing-storage/incomes/$incomeId": { id: "/marketing-storage/incomes/$incomeId"; path: "/marketing-storage/incomes/$incomeId"; fullPath: "/marketing-storage/incomes/$incomeId"; preLoaderRoute: typeof incomeDetailRoute; parentRoute: typeof rootRoute }
  }
}
