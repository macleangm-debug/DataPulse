import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { FileText, Loader2 } from 'lucide-react';

function FormSelector({
  forms = [],
  selectedFormId,
  loading = false,
  onSelectForm
}) {
  return (
    <Select value={selectedFormId || ""} onValueChange={onSelectForm}>
      <SelectTrigger className="w-[250px]" data-testid="form-selector">
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading forms...</span>
          </div>
        ) : (
          <SelectValue placeholder="Select a form..." />
        )}
      </SelectTrigger>
      <SelectContent>
        {forms.length === 0 ? (
          <div className="p-2 text-center text-muted-foreground text-sm">
            No forms available
          </div>
        ) : (
          forms.map((form) => (
            <SelectItem key={form.id} value={form.id}>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{form.name || form.title}</span>
                {form.submission_count !== undefined && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {form.submission_count}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

export default FormSelector;
