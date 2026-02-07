import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, CheckCircle } from 'lucide-react';

interface ConfigPanelProps {
  config: {
    apiUrl: string;
  };
  onConfigChange: (config: { apiUrl: string }) => void;
}

export function ConfigPanel({ config, onConfigChange }: ConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    onConfigChange(localConfig);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Configuration
        </CardTitle>
        <CardDescription className="text-xs">
          Configure tool API endpoint
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 p-2 rounded">
          <CheckCircle className="h-4 w-4" />
          <span>OpenAI API key configured via Supabase</span>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="apiUrl" className="text-xs">Tool API URL</Label>
          <Input
            id="apiUrl"
            value={localConfig.apiUrl}
            onChange={(e) => setLocalConfig({ ...localConfig, apiUrl: e.target.value })}
            placeholder="https://www.lookfor.ai"
            className="text-xs"
          />
        </div>

        <Button onClick={handleSave} className="w-full" size="sm">
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
