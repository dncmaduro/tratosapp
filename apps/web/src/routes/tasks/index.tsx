import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "../../components/layouts/AppLayout"
import { TaskWorkspace } from "../../components/task-management/TaskWorkspace"
import { useAuthGuard } from "../../hooks/useAuthGuard"

export const Route = createFileRoute("/tasks/")({ component: RouteComponent })

function RouteComponent() {
  useAuthGuard(["tasks.view"])
  return <AppLayout sidebarVariant="tasks"><TaskWorkspace /></AppLayout>
}
