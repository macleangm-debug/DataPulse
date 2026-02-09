/**
 * API Documentation Page
 * Developer documentation for DataPulse Public API
 */

import React, { useState } from 'react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Copy, 
  Check, 
  Key, 
  Webhook, 
  FileJson, 
  Code, 
  Shield,
  Zap,
  Database,
  ArrowRight,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Code examples
const CODE_EXAMPLES = {
  authentication: `# All API requests require an API key
curl -X GET "${API_BASE}/api/v1/forms" \\
  -H "X-API-Key: dp_your_api_key_here"`,
  
  listForms: `# List all forms
curl -X GET "${API_BASE}/api/v1/forms" \\
  -H "X-API-Key: dp_xxxxx"

# Response:
[
  {
    "id": "abc123",
    "name": "Household Survey",
    "status": "active",
    "question_count": 45,
    "submission_count": 1234
  }
]`,

  getFormSchema: `# Get form schema for integration
curl -X GET "${API_BASE}/api/v1/forms/{form_id}/schema" \\
  -H "X-API-Key: dp_xxxxx"

# Response:
{
  "form_id": "abc123",
  "name": "Household Survey",
  "fields": [
    {
      "name": "respondent_name",
      "label": "Respondent Name",
      "type": "text",
      "required": true
    },
    {
      "name": "age",
      "label": "Age",
      "type": "number",
      "required": true,
      "validation": {"min": 0, "max": 120}
    }
  ]
}`,

  createSubmission: `# Submit data to a form
curl -X POST "${API_BASE}/api/v1/submissions" \\
  -H "X-API-Key: dp_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "form_id": "abc123",
    "data": {
      "respondent_name": "John Doe",
      "age": 35,
      "location": "Nairobi"
    },
    "metadata": {
      "source": "mobile_app",
      "device_id": "device_123"
    },
    "gps": {
      "latitude": -1.2921,
      "longitude": 36.8219
    }
  }'`,

  webhookSetup: `# Create a webhook subscription
curl -X POST "${API_BASE}/api/v1/webhooks" \\
  -H "X-API-Key: dp_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook",
    "events": [
      "submission.created",
      "submission.approved",
      "quality.alert"
    ]
  }'`,

  webhookPayload: `# Webhook payload example
{
  "event": "submission.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "submission_id": "sub_123",
    "form_id": "abc123",
    "submitted_at": "2024-01-15T10:30:00Z"
  }
}

# Verify webhook signature:
signature = HMAC-SHA256(secret, timestamp + "." + payload)`,

  exportData: `# Export submissions as JSON
curl -X POST "${API_BASE}/api/v1/export" \\
  -H "X-API-Key: dp_xxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "form_id": "abc123",
    "format": "json",
    "filters": {
      "status": "approved",
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    }
  }'`
};

const ENDPOINTS = [
  {
    category: 'Forms',
    endpoints: [
      { method: 'GET', path: '/api/v1/forms', description: 'List all forms', auth: 'read' },
      { method: 'GET', path: '/api/v1/forms/{id}', description: 'Get form details', auth: 'read' },
      { method: 'GET', path: '/api/v1/forms/{id}/schema', description: 'Get form schema', auth: 'read' },
    ]
  },
  {
    category: 'Submissions',
    endpoints: [
      { method: 'GET', path: '/api/v1/submissions', description: 'List submissions', auth: 'read' },
      { method: 'GET', path: '/api/v1/submissions/{id}', description: 'Get submission', auth: 'read' },
      { method: 'POST', path: '/api/v1/submissions', description: 'Create submission', auth: 'write' },
      { method: 'PATCH', path: '/api/v1/submissions/{id}', description: 'Update submission', auth: 'write' },
    ]
  },
  {
    category: 'Projects',
    endpoints: [
      { method: 'GET', path: '/api/v1/projects', description: 'List projects', auth: 'read' },
    ]
  },
  {
    category: 'Data Export',
    endpoints: [
      { method: 'POST', path: '/api/v1/export', description: 'Export form data', auth: 'read' },
      { method: 'GET', path: '/api/v1/stats/summary/{form_id}', description: 'Get form statistics', auth: 'read' },
    ]
  },
  {
    category: 'Webhooks',
    endpoints: [
      { method: 'GET', path: '/api/v1/webhooks', description: 'List webhooks', auth: 'read' },
      { method: 'POST', path: '/api/v1/webhooks', description: 'Create webhook', auth: 'admin' },
      { method: 'DELETE', path: '/api/v1/webhooks/{id}', description: 'Delete webhook', auth: 'admin' },
    ]
  },
  {
    category: 'API Keys',
    endpoints: [
      { method: 'GET', path: '/api/v1/api-keys', description: 'List API keys', auth: 'internal' },
      { method: 'POST', path: '/api/v1/api-keys', description: 'Create API key', auth: 'internal' },
      { method: 'DELETE', path: '/api/v1/api-keys/{id}', description: 'Revoke API key', auth: 'internal' },
    ]
  }
];

const WEBHOOK_EVENTS = [
  { event: 'submission.created', description: 'Triggered when a new submission is received' },
  { event: 'submission.updated', description: 'Triggered when submission data is modified' },
  { event: 'submission.approved', description: 'Triggered when a submission is approved' },
  { event: 'submission.rejected', description: 'Triggered when a submission is rejected' },
  { event: 'form.published', description: 'Triggered when a form is published' },
  { event: 'form.closed', description: 'Triggered when a form is closed' },
  { event: 'quality.alert', description: 'Triggered when a quality issue is detected' },
  { event: 'sync.completed', description: 'Triggered when offline sync completes' },
  { event: 'export.ready', description: 'Triggered when data export is ready' },
];

function CodeBlock({ code, language = 'bash' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    POST: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    PATCH: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    DELETE: 'bg-red-500/10 text-red-600 border-red-500/20',
  };

  return (
    <span className={cn('px-2 py-0.5 text-xs font-mono font-bold rounded border', colors[method])}>
      {method}
    </span>
  );
}

export default function APIDocsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">API Documentation</h1>
          <p className="text-slate-500 mt-2">
            Integrate DataPulse with your existing systems using our REST API
          </p>
        </div>

        {/* Quick Start */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Quick Start</h2>
                <p className="text-slate-600 mt-1 mb-4">
                  Get started in 3 steps: Create an API key, make your first request, set up webhooks for real-time updates.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-2">
                    <Key className="w-4 h-4" />
                    Create API Key
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    View on Swagger
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="endpoints" className="space-y-6">
          <TabsList>
            <TabsTrigger value="endpoints" className="gap-2">
              <Code className="w-4 h-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="authentication" className="gap-2">
              <Shield className="w-4 h-4" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="examples" className="gap-2">
              <Terminal className="w-4 h-4" />
              Examples
            </TabsTrigger>
          </TabsList>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Endpoints</CardTitle>
                <CardDescription>
                  Base URL: <code className="text-primary">{API_BASE}/api/v1</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ENDPOINTS.map((group) => (
                  <div key={group.category}>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">{group.category}</h3>
                    <div className="space-y-2">
                      {group.endpoints.map((endpoint) => (
                        <div
                          key={endpoint.path}
                          className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <MethodBadge method={endpoint.method} />
                          <code className="text-sm text-slate-700 flex-1 font-mono">{endpoint.path}</code>
                          <span className="text-sm text-slate-500">{endpoint.description}</span>
                          <Badge variant="outline" className="text-[10px]">{endpoint.auth}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="authentication" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Key Authentication
                </CardTitle>
                <CardDescription>
                  All API requests must include your API key in the X-API-Key header
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock code={CODE_EXAMPLES.authentication} />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <h4 className="font-medium text-emerald-900">Read Permission</h4>
                    <p className="text-sm text-emerald-700 mt-1">
                      Access forms, submissions, and statistics
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <h4 className="font-medium text-blue-900">Write Permission</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Create and update submissions
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <h4 className="font-medium text-amber-900">Admin Permission</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Manage webhooks and full access
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="w-5 h-5" />
                  Webhook Events
                </CardTitle>
                <CardDescription>
                  Subscribe to real-time events from DataPulse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div
                      key={event.event}
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-50"
                    >
                      <code className="text-sm text-primary font-mono bg-primary/10 px-2 py-1 rounded">
                        {event.event}
                      </code>
                      <span className="text-sm text-slate-600">{event.description}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-slate-900 mb-3">Webhook Setup Example</h4>
                  <CodeBlock code={CODE_EXAMPLES.webhookSetup} />
                </div>

                <div className="mt-6">
                  <h4 className="font-medium text-slate-900 mb-3">Webhook Payload & Verification</h4>
                  <CodeBlock code={CODE_EXAMPLES.webhookPayload} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
                <CardDescription>
                  Common API operations with curl
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium text-slate-900 mb-3">List Forms</h4>
                  <CodeBlock code={CODE_EXAMPLES.listForms} />
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 mb-3">Get Form Schema</h4>
                  <CodeBlock code={CODE_EXAMPLES.getFormSchema} />
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 mb-3">Submit Data</h4>
                  <CodeBlock code={CODE_EXAMPLES.createSubmission} />
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 mb-3">Export Data</h4>
                  <CodeBlock code={CODE_EXAMPLES.exportData} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rate Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-900">1,000</p>
                <p className="text-sm text-slate-500">Requests per minute</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-900">10,000</p>
                <p className="text-sm text-slate-500">Submissions per day</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-2xl font-bold text-slate-900">100 MB</p>
                <p className="text-sm text-slate-500">Max export size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
