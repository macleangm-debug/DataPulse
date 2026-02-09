import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Table, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

function ResponseBrowser({ 
  responses = [], 
  total = 0, 
  page = 1, 
  pageSize = 20,
  loading = false,
  formFields = [],
  onPageChange,
  onViewResponse
}) {
  const totalPages = Math.ceil(total / pageSize);
  
  // Get display fields (first 5 or so)
  const displayFields = formFields.slice(0, 5);

  if (!responses.length && !loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            <CardTitle className="font-barlow text-lg">Response Browser</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Select a form to browse responses</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="h-5 w-5 text-primary" />
            <CardTitle className="font-barlow text-lg">Response Browser</CardTitle>
          </div>
          <Badge variant="outline">{total} responses</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b">
                <th className="text-left p-2 font-medium">#</th>
                {displayFields.map(field => (
                  <th key={field.id} className="text-left p-2 font-medium truncate max-w-[150px]">
                    {field.label || field.id}
                  </th>
                ))}
                <th className="text-right p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response, index) => (
                <tr key={response.id || index} className="border-b hover:bg-muted/50">
                  <td className="p-2 text-muted-foreground">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  {displayFields.map(field => (
                    <td key={field.id} className="p-2 truncate max-w-[150px]">
                      {formatCellValue(response.data?.[field.id] || response[field.id])}
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onViewResponse?.(response)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).slice(0, 50);
}

export default ResponseBrowser;
