import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore, useUIStore } from './store';
import { LoginPage, RegisterPage, AuthCallbackPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { FormsPage } from './pages/FormsPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormPreviewPage } from './pages/FormPreviewPage';
import { FormTemplatesPage } from './pages/FormTemplatesPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { TeamPage, CreateOrganizationPage } from './pages/TeamPage';
import { CasesPage } from './pages/CasesPage';
import { CaseImportPage } from './pages/CaseImportPage';
import { QualityPage } from './pages/QualityPage';
import { SettingsPage } from './pages/SettingsPage';
import { GPSMapPage } from './pages/GPSMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { RBACPage } from './pages/RBACPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { TranslationsPage } from './pages/TranslationsPage';
import { SecurityPage } from './pages/SecurityPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { TokenSurveysPage } from './pages/TokenSurveysPage';
import { CATIPage } from './pages/CATIPage';
import { BackcheckPage } from './pages/BackcheckPage';
import { PreloadWritebackPage } from './pages/PreloadWritebackPage';
import { QualityAIPage } from './pages/QualityAIPage';
import { PluginsPage } from './pages/PluginsPage';
import { CAWISurveyPage, SurveyCompletePage } from './pages/CAWISurveyPage';
import { SimulationPage } from './pages/SimulationPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { DataAnalysisPage } from './pages/DataAnalysisPage';
import { PWAInstallPrompt, NetworkStatus } from './components/PWAComponents';
import { NetworkStatusBanner, SyncStatusPanel } from './components/OfflineSync';
import '@/App.css';

// Register service worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      
      // Store registration for background sync
      window.registration = registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Public Route wrapper (redirect to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const { theme } = useUIStore();

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          } />
          <Route path="/projects/:projectId" element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          } />
          <Route path="/forms" element={
            <ProtectedRoute>
              <FormsPage />
            </ProtectedRoute>
          } />
          <Route path="/forms/new" element={
            <ProtectedRoute>
              <FormsPage />
            </ProtectedRoute>
          } />
          <Route path="/forms/:formId" element={
            <ProtectedRoute>
              <FormBuilderPage />
            </ProtectedRoute>
          } />
          <Route path="/forms/:formId/edit" element={
            <ProtectedRoute>
              <FormBuilderPage />
            </ProtectedRoute>
          } />
          <Route path="/forms/:formId/preview" element={
            <ProtectedRoute>
              <FormPreviewPage />
            </ProtectedRoute>
          } />
          <Route path="/submissions" element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          } />
          <Route path="/cases" element={
            <ProtectedRoute>
              <CasesPage />
            </ProtectedRoute>
          } />
          <Route path="/cases/import" element={
            <ProtectedRoute>
              <CaseImportPage />
            </ProtectedRoute>
          } />
          <Route path="/quality" element={
            <ProtectedRoute>
              <QualityPage />
            </ProtectedRoute>
          } />
          <Route path="/map" element={
            <ProtectedRoute>
              <GPSMapPage />
            </ProtectedRoute>
          } />
          <Route path="/templates" element={
            <ProtectedRoute>
              <FormTemplatesPage />
            </ProtectedRoute>
          } />
          <Route path="/exports" element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          } />
          <Route path="/team" element={
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
          <Route path="/rbac" element={
            <ProtectedRoute>
              <RBACPage />
            </ProtectedRoute>
          } />
          <Route path="/workflows" element={
            <ProtectedRoute>
              <WorkflowsPage />
            </ProtectedRoute>
          } />
          <Route path="/translations" element={
            <ProtectedRoute>
              <TranslationsPage />
            </ProtectedRoute>
          } />
          <Route path="/security" element={
            <ProtectedRoute>
              <SecurityPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <SuperAdminPage />
            </ProtectedRoute>
          } />
          <Route path="/datasets" element={
            <ProtectedRoute>
              <DatasetsPage />
            </ProtectedRoute>
          } />
          <Route path="/token-surveys" element={
            <ProtectedRoute>
              <TokenSurveysPage />
            </ProtectedRoute>
          } />
          <Route path="/cati" element={
            <ProtectedRoute>
              <CATIPage />
            </ProtectedRoute>
          } />
          <Route path="/backcheck" element={
            <ProtectedRoute>
              <BackcheckPage />
            </ProtectedRoute>
          } />
          <Route path="/preload" element={
            <ProtectedRoute>
              <PreloadWritebackPage />
            </ProtectedRoute>
          } />
          <Route path="/quality-ai" element={
            <ProtectedRoute>
              <QualityAIPage />
            </ProtectedRoute>
          } />
          <Route path="/plugins" element={
            <ProtectedRoute>
              <PluginsPage />
            </ProtectedRoute>
          } />
          <Route path="/simulation" element={
            <ProtectedRoute>
              <SimulationPage />
            </ProtectedRoute>
          } />
          <Route path="/devices" element={
            <ProtectedRoute>
              <DeviceManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/analysis" element={
            <ProtectedRoute>
              <DataAnalysisPage />
            </ProtectedRoute>
          } />
          {/* Public CAWI Survey Routes */}
          <Route path="/survey/:formId" element={<CAWISurveyPage />} />
          <Route path="/survey/complete" element={<SurveyCompletePage />} />
          <Route path="/organizations/new" element={
            <ProtectedRoute>
              <CreateOrganizationPage />
            </ProtectedRoute>
          } />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        
        {/* PWA Components */}
        <PWAInstallPrompt />
        
        {/* Offline Sync Status */}
        <NetworkStatusBanner />
      </BrowserRouter>
      
      <Toaster 
        position="top-right" 
        richColors 
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))'
          }
        }}
      />
    </div>
  );
}

export default App;
