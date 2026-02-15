import React from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { useOrgStore } from '../store';

export function AnalyticsPage() {
  const { currentOrg } = useOrgStore();

  return (
    <DashboardLayout>
      <AnalyticsDashboard orgId={currentOrg?.id} />
    </DashboardLayout>
  );
}
