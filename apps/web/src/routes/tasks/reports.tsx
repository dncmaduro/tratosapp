import { createFileRoute } from "@tanstack/react-router"
import { AppLayout } from "../../components/layouts/AppLayout"
import { TaskReportsPage } from "../../components/task-management/TaskReportsPage"
import { useAuthGuard } from "../../hooks/useAuthGuard"

export const Route = createFileRoute("/tasks/reports")({ component: RouteComponent })

function RouteComponent() {
  useAuthGuard(["tasks.reports.view"])
  return <AppLayout sidebarVariant="tasks"><TaskReportsPage /></AppLayout>
}
