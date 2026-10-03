import { createFileRoute } from "@tanstack/react-router"
import { Helmet } from "react-helmet-async"

import { AppLayout } from "../../../components/layouts/AppLayout"
import { StorageItemsPage } from "../../../components/storage/StorageItemsPage"
import { TIKTOKSHOP_NAVS } from "../../../constants/navs"

export const Route = createFileRoute("/tiktokshop/storage-items/")({ component: RouteComponent })

function RouteComponent() {
  return (
    <>
      <Helmet><title>Storage Items | Tratosapp</title></Helmet>
      <AppLayout navs={TIKTOKSHOP_NAVS}>
        <StorageItemsPage />
      </AppLayout>
    </>
  )
}
