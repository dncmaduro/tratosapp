import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "../../components/layouts/AppLayout"
import { TaskAdminPage } from "../../components/task-management/TaskAdminPage"
import { useAuthGuard } from "../../hooks/useAuthGuard"

export const Route = createFileRoute("/tasks/admin")({ component: RouteComponent })

function RouteComponent() {
  useAuthGuard(["tasks.taxonomy.manage"])
  return <AppLayout sidebarVariant="tasks"><TaskAdminPage /></AppLayout>
}
