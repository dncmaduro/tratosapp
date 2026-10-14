import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "../../../components/layouts/AppLayout"
import { TaskEditPage } from "../../../components/task-management/TaskEditPage"
import { useAuthGuard } from "../../../hooks/useAuthGuard"

export const Route = createFileRoute("/tasks/$taskId/edit")({ component: RouteComponent })

function RouteComponent() {
  useAuthGuard(["tasks.update"])
  return <AppLayout sidebarVariant="tasks"><TaskEditPage /></AppLayout>
}
