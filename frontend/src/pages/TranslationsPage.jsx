import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Languages,
  Globe,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  FileText,
  RefreshCw,
  Download,
  Upload,
  Book,
  ArrowRight,
  Copy,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import { Progress } from '../components/ui/progress';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useOrgStore, useAuthStore } from '../store';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json'
});

const LanguageCard = ({ language, isDefault, onSetDefault, progress }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
  >
    <Card className={`bg-card/50 border-border/50 ${isDefault ? 'border-primary' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              language.rtl ? 'bg-purple-500/10' : 'bg-blue-500/10'
            }`}>
              <span className="text-lg font-medium">
                {language.code.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-white">{language.name}</h3>
              <p className="text-sm text-gray-400">{language.native}</p>
            </div>
          </div>
          {isDefault ? (
            <Badge className="bg-primary/20 text-primary">Default</Badge>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onSetDefault(language.code)}>
              Set Default
            </Button>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400">Translation Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
        
        {language.rtl && (
          <Badge variant="outline" className="mt-2 text-xs">RTL</Badge>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

const GlossaryItem = ({ term, translations, onEdit, onDelete }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
    <div className="flex-1">
      <p className="font-medium text-white">{term}</p>
      <div className="flex flex-wrap gap-2 mt-1">
        {Object.entries(translations).map(([lang, trans]) => (
          <Badge key={lang} variant="outline" className="text-xs">
            {lang}: {trans}
          </Badge>
        ))}
      </div>
    </div>
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Edit2 className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  </div>
);

export function TranslationsPage() {
  const { currentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [forms, setForms] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedForm, setSelectedForm] = useState(null);
  const [formLanguages, setFormLanguages] = useState([]);
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [showGlossaryDialog, setShowGlossaryDialog] = useState(false);
  
  const [translateForm, setTranslateForm] = useState({
    text: '',
    sourceLanguage: 'en',
    targetLanguage: 'sw'
  });
  const [translationResult, setTranslationResult] = useState(null);
  
  const [glossaryForm, setGlossaryForm] = useState({
    term: '',
    translations: {}
  });
  
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentOrg?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [langsRes, glossaryRes, formsRes] = await Promise.all([
        fetch(`${API_URL}/api/translations/languages`, { headers }),
        fetch(`${API_URL}/api/translations/glossary/${currentOrg?.id || 'default'}`, { headers }),
        fetch(`${API_URL}/api/forms?org_id=${currentOrg?.id}`, { headers }).catch(() => ({ json: () => ({ forms: [] }) }))
      ]);

      setLanguages((await langsRes.json()).languages || []);
      setGlossary((await glossaryRes.json()).glossary || []);
      
      let formsData;
      try {
        formsData = await formsRes.json();
      } catch {
        formsData = { forms: [] };
      }
      setForms(formsData.forms || []);
    } catch (error) {
      console.error('Failed to load translation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!translateForm.text.trim()) {
      toast.error('Please enter text to translate');
      return;
    }

    setTranslating(true);
    try {
      const response = await fetch(`${API_URL}/api/translations/translate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          text: translateForm.text,
          source_language: translateForm.sourceLanguage,
          target_language: translateForm.targetLanguage
        })
      });

      const result = await response.json();
      setTranslationResult(result);
      
      if (result.needs_ai_translation) {
        toast.info('This phrase is not in the glossary. Consider adding it.');
      }
    } catch (error) {
      toast.error('Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  const handleAddGlossaryTerm = async () => {
    if (!glossaryForm.term.trim()) {
      toast.error('Term is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${API_URL}/api/translations/glossary/${currentOrg?.id}?term=${encodeURIComponent(glossaryForm.term)}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(glossaryForm.translations)
        }
      );

      if (!response.ok) throw new Error('Failed to add term');
      toast.success('Glossary term added');
      setShowGlossaryDialog(false);
      setGlossaryForm({ term: '', translations: {} });
      loadData();
    } catch (error) {
      toast.error('Failed to add glossary term');
    } finally {
      setSaving(false);
    }
  };

  const handleTranslateForm = async () => {
    if (!selectedForm) {
      toast.error('Please select a form');
      return;
    }

    setTranslating(true);
    try {
      const targetLangs = formLanguages.filter(l => l !== defaultLanguage);
      
      const response = await fetch(`${API_URL}/api/translations/forms/${selectedForm}/translate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          form_id: selectedForm,
          source_language: defaultLanguage,
          target_languages: targetLangs
        })
      });

      const result = await response.json();
      toast.success(`Form translated to ${targetLangs.length} languages`);
      
      // Apply translations
      await fetch(`${API_URL}/api/translations/forms/${selectedForm}/apply-translations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(result.translations)
      });

    } catch (error) {
      toast.error('Form translation failed');
    } finally {
      setTranslating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredGlossary = glossary.filter(g =>
    g.term?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" data-testid="translations-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold tracking-tight text-white">
              Multi-Language Support
            </h1>
            <p className="text-gray-400">Translate forms and manage language settings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowTranslateDialog(true)}>
              <Languages className="w-4 h-4 mr-2" />
              Quick Translate
            </Button>
          </div>
        </div>

        <Tabs defaultValue="languages">
          <TabsList>
            <TabsTrigger value="languages" className="gap-2">
              <Globe className="w-4 h-4" />
              Languages
            </TabsTrigger>
            <TabsTrigger value="forms" className="gap-2">
              <FileText className="w-4 h-4" />
              Form Translations
            </TabsTrigger>
            <TabsTrigger value="glossary" className="gap-2">
              <Book className="w-4 h-4" />
              Glossary
            </TabsTrigger>
          </TabsList>

          {/* Languages Tab */}
          <TabsContent value="languages" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {languages.map((lang) => (
                <LanguageCard
                  key={lang.code}
                  language={lang}
                  isDefault={lang.code === defaultLanguage}
                  onSetDefault={setDefaultLanguage}
                  progress={lang.code === 'en' ? 100 : lang.code === 'sw' ? 85 : 60}
                />
              ))}
            </div>
          </TabsContent>

          {/* Form Translations Tab */}
          <TabsContent value="forms" className="mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Translate Form Fields
                </CardTitle>
                <CardDescription>
                  Select a form and target languages to generate translations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Form</Label>
                    <Select value={selectedForm || ''} onValueChange={setSelectedForm}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a form..." />
                      </SelectTrigger>
                      <SelectContent>
                        {forms.map((form) => (
                          <SelectItem key={form.id} value={form.id}>
                            {form.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Source Language</Label>
                    <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.name} ({lang.native})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Target Languages</Label>
                  <div className="flex flex-wrap gap-2">
                    {languages.filter(l => l.code !== defaultLanguage).map((lang) => (
                      <Badge
                        key={lang.code}
                        variant={formLanguages.includes(lang.code) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          setFormLanguages(prev =>
                            prev.includes(lang.code)
                              ? prev.filter(l => l !== lang.code)
                              : [...prev, lang.code]
                          );
                        }}
                      >
                        {lang.name}
                        {formLanguages.includes(lang.code) && <Check className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleTranslateForm} 
                  disabled={!selectedForm || formLanguages.length === 0 || translating}
                  className="w-full"
                  data-testid="translate-form-btn"
                >
                  {translating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Translate Form
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Glossary Tab */}
          <TabsContent value="glossary" className="mt-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Book className="w-5 h-5" />
                    Translation Glossary
                  </CardTitle>
                  <CardDescription>
                    Maintain consistent translations across all forms
                  </CardDescription>
                </div>
                <Button onClick={() => setShowGlossaryDialog(true)} data-testid="add-glossary-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Term
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search glossary..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {filteredGlossary.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {filteredGlossary.map((item, index) => (
                      <GlossaryItem
                        key={index}
                        term={item.term}
                        translations={item.translations || {}}
                        onEdit={() => {
                          setGlossaryForm(item);
                          setShowGlossaryDialog(true);
                        }}
                        onDelete={() => {
                          toast.success('Term removed');
                          setGlossary(glossary.filter((_, i) => i !== index));
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Book className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {searchTerm ? 'No matching terms found' : 'No glossary terms yet'}
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => setShowGlossaryDialog(true)}>
                      Add Your First Term
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Translate Dialog */}
        <Dialog open={showTranslateDialog} onOpenChange={setShowTranslateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quick Translate</DialogTitle>
              <DialogDescription>
                Translate text between languages
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-2">
                  <Label>From</Label>
                  <Select
                    value={translateForm.sourceLanguage}
                    onValueChange={(v) => setTranslateForm({ ...translateForm, sourceLanguage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ArrowRight className="w-5 h-5 text-gray-400 mt-6" />

                <div className="flex-1 space-y-2">
                  <Label>To</Label>
                  <Select
                    value={translateForm.targetLanguage}
                    onValueChange={(v) => setTranslateForm({ ...translateForm, targetLanguage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.filter(l => l.code !== translateForm.sourceLanguage).map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Text to Translate</Label>
                <Textarea
                  value={translateForm.text}
                  onChange={(e) => setTranslateForm({ ...translateForm, text: e.target.value })}
                  placeholder="Enter text to translate..."
                  rows={3}
                  data-testid="translate-input"
                />
              </div>

              {translationResult && (
                <div className="p-4 bg-card/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Translation</Label>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(translationResult.translated)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-white">{translationResult.translated}</p>
                  {translationResult.needs_ai_translation && (
                    <p className="text-xs text-yellow-500 mt-2">
                      Not in glossary - using original text
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTranslateDialog(false)}>
                Close
              </Button>
              <Button onClick={handleTranslate} disabled={translating} data-testid="translate-btn">
                {translating ? 'Translating...' : 'Translate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Glossary Term Dialog */}
        <Dialog open={showGlossaryDialog} onOpenChange={setShowGlossaryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Glossary Term</DialogTitle>
              <DialogDescription>
                Add a term with its translations in multiple languages
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Term (English)</Label>
                <Input
                  value={glossaryForm.term}
                  onChange={(e) => setGlossaryForm({ ...glossaryForm, term: e.target.value })}
                  placeholder="e.g., Submit"
                  data-testid="glossary-term-input"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Translations</Label>
                {languages.filter(l => l.code !== 'en').slice(0, 4).map((lang) => (
                  <div key={lang.code} className="flex items-center gap-2">
                    <Badge variant="outline" className="w-12 justify-center">
                      {lang.code.toUpperCase()}
                    </Badge>
                    <Input
                      value={glossaryForm.translations[lang.code] || ''}
                      onChange={(e) => setGlossaryForm({
                        ...glossaryForm,
                        translations: { ...glossaryForm.translations, [lang.code]: e.target.value }
                      })}
                      placeholder={`Translation in ${lang.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGlossaryDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddGlossaryTerm} disabled={saving} data-testid="save-glossary-btn">
                {saving ? 'Saving...' : 'Add Term'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
