/**
 * DataPulse Language Selector Component
 * Allows users to switch between available languages
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { cn } from '../lib/utils';

export function LanguageSelector({ variant = 'default', showLabel = false, className }) {
  const { i18n, t } = useTranslation();
  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === i18n.language) 
    || SUPPORTED_LANGUAGES[0];

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    // Update document direction for RTL languages
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    document.documentElement.dir = lang?.dir || 'ltr';
    document.documentElement.lang = langCode;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("text-muted-foreground hover:text-foreground", className)}
            data-testid="language-selector-btn"
          >
            <Globe className="w-5 h-5" />
          </Button>
        ) : variant === 'minimal' ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn("text-muted-foreground hover:text-foreground gap-1", className)}
            data-testid="language-selector-btn"
          >
            <span className="text-base">{currentLanguage.flag}</span>
            <span className="uppercase text-xs font-medium">{currentLanguage.code}</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className={cn("gap-2", className)}
            data-testid="language-selector-btn"
          >
            <Globe className="w-4 h-4" />
            {showLabel && (
              <>
                <span>{currentLanguage.nativeName}</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t('settings.language')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`lang-option-${lang.code}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{lang.flag}</span>
              <div className="flex flex-col">
                <span className="font-medium">{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
            </div>
            {i18n.language === lang.code && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Compact language selector for header/navbar
export function LanguageSelectorCompact({ className }) {
  return <LanguageSelector variant="minimal" className={className} />;
}

// Icon-only language selector
export function LanguageSelectorIcon({ className }) {
  return <LanguageSelector variant="icon" className={className} />;
}

export default LanguageSelector;
