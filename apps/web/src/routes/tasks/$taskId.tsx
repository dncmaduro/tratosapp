import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "../../components/layouts/AppLayout"
import { TaskDetailPage } from "../../components/task-management/TaskDetailPage"
import { useAuthGuard } from "../../hooks/useAuthGuard"

export const Route = createFileRoute("/tasks/$taskId")({ component: RouteComponent })

function RouteComponent() {
  useAuthGuard(["tasks.view"])
  return <AppLayout sidebarVariant="tasks"><TaskDetailPage /></AppLayout>
}
