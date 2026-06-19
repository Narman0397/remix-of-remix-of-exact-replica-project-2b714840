import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/admin/documents/")({
  component: () => <Navigate to="/admin/documents/templates" />,
});
