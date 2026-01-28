import { Card, SectionTitle } from "../ui/components";

export default function AdminDashboard() {
  return (
    <div className="page">
      <SectionTitle title="Admin Console" subtitle="System configuration shell." />
      <Card>
        <p className="muted">
          Admin tools will live here (user provisioning, territory setup, content governance).
        </p>
      </Card>
    </div>
  );
}
