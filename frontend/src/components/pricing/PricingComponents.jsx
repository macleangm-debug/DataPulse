/**
 * DataPulse - Reusable Pricing Components
 * Copy this folder to any React project!
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, X, Zap, Rocket, Star, Crown, 
  ChevronDown, Shield, Lock, Server, Key,
  Users, HardDrive, Mail, Building2, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { cn } from '../../lib/utils';
import { 
  PRICING_TIERS, 
  FEATURE_CATEGORIES, 
  FAQ_ITEMS, 
  TRUST_BADGES,
  calculatePrice,
  formatPrice,
  formatLimit,
  tierHasFeature,
  getAnnualDiscount
} from './PricingConfig';

// Icon mapping
const iconMap = {
  Zap, Rocket, Star, Crown, Shield, Lock, Server, Key
};

// ============================================================================
// PRICING TOGGLE
// ============================================================================
export const PricingToggle = ({ 
  value = 'annual', 
  onChange,
  showBadge = true,
  className 
}) => {
  const isAnnual = value === 'annual';
  
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <span className={cn(
        "text-sm font-medium transition-colors",
        !isAnnual ? 'text-foreground' : 'text-muted-foreground'
      )}>
        Monthly
      </span>
      <Switch
        checked={isAnnual}
        onCheckedChange={(checked) => onChange?.(checked ? 'annual' : 'monthly')}
        data-testid="billing-toggle"
      />
      <span className={cn(
        "text-sm font-medium transition-colors",
        isAnnual ? 'text-foreground' : 'text-muted-foreground'
      )}>
        Annual
      </span>
      {showBadge && isAnnual && (
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
          <Sparkles className="h-3 w-3 mr-1" />
          Save {getAnnualDiscount()}%
        </Badge>
      )}
    </div>
  );
};

// ============================================================================
// PRICING CARD
// ============================================================================
export const PricingCard = ({ 
  tier, 
  billingCycle = 'annual',
  isCurrentPlan = false,
  onSelect,
  className,
  showFeatures = true,
  compact = false
}) => {
  const IconComponent = iconMap[tier.icon] || Zap;
  const price = calculatePrice(tier, billingCycle);
  const isAnnual = billingCycle === 'annual';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        className={cn(
          "relative flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10",
          tier.popular && "border-purple-500 shadow-lg shadow-purple-500/20",
          isCurrentPlan && "ring-2 ring-green-500/50",
          className
        )}
        data-testid={`pricing-card-${tier.id}`}
      >
        {/* Badge */}
        {tier.badge && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
            <Badge className={cn("bg-gradient-to-r text-white border-0", tier.color)}>
              {tier.badge}
            </Badge>
          </div>
        )}
        
        <CardHeader className="text-center pb-4">
          <div className={cn(
            "w-12 h-12 rounded-xl bg-gradient-to-br p-2.5 mx-auto mb-3",
            tier.color
          )}>
            <IconComponent className="w-full h-full text-white" />
          </div>
          <CardTitle className="text-xl">{tier.name}</CardTitle>
          <CardDescription className="text-sm">{tier.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 space-y-6">
          {/* Price */}
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">{formatPrice(price)}</span>
              {tier.monthlyPrice > 0 && (
                <span className="text-muted-foreground">/mo</span>
              )}
            </div>
            {tier.monthlyPrice > 0 && isAnnual && (
              <p className="text-xs text-muted-foreground mt-1">
                Billed annually (${tier.annualPrice.toFixed(0)}/year)
              </p>
            )}
          </div>
          
          {showFeatures && !compact && (
            <>
              <Separator />
              
              {/* Key Limits */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{formatLimit(tier.limits.users)} users</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>{tier.limits.storage} storage</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{tier.limits.emails} emails</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{tier.limits.submissions} submissions</span>
                </div>
              </div>
              
              <Separator />
              
              {/* Feature List */}
              <div className="space-y-2">
                {Object.entries(tier.features).slice(0, 2).map(([category, features]) => (
                  features.slice(0, 3).map((featureId) => {
                    const feature = FEATURE_CATEGORIES
                      .flatMap(c => c.features)
                      .find(f => f.id === featureId);
                    if (!feature) return null;
                    return (
                      <div key={featureId} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature.label}</span>
                      </div>
                    );
                  })
                ))}
              </div>
            </>
          )}
        </CardContent>
        
        <CardFooter>
          <Button
            className={cn(
              "w-full",
              tier.popular && `bg-gradient-to-r ${tier.color} hover:opacity-90`
            )}
            variant={tier.popular ? 'default' : 'outline'}
            disabled={isCurrentPlan}
            onClick={() => onSelect?.(tier)}
            data-testid={`select-plan-${tier.id}`}
          >
            {isCurrentPlan ? 'Current Plan' : (
              <>
                {tier.cta}
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

// ============================================================================
// PRICING GRID
// ============================================================================
export const PricingGrid = ({ 
  tiers = PRICING_TIERS,
  billingCycle = 'annual',
  currentTierId,
  onSelect,
  columns = 4,
  className
}) => {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4'
  };
  
  return (
    <div className={cn(
      "grid grid-cols-1 gap-6",
      gridCols[columns] || gridCols[4],
      className
    )}>
      {tiers.map((tier, index) => (
        <PricingCard
          key={tier.id}
          tier={tier}
          billingCycle={billingCycle}
          isCurrentPlan={currentTierId === tier.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

// ============================================================================
// PRICING COMPARISON TABLE
// ============================================================================
export const PricingComparison = ({ 
  tiers = PRICING_TIERS,
  categories = FEATURE_CATEGORIES,
  className
}) => {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-4 font-medium">Features</th>
            {tiers.map(tier => (
              <th key={tier.id} className="text-center p-4 font-medium">
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map(category => (
            <React.Fragment key={category.name}>
              <tr className="bg-muted/30">
                <td colSpan={tiers.length + 1} className="p-3 font-semibold text-sm">
                  {category.name}
                </td>
              </tr>
              {category.features.map(feature => (
                <tr key={feature.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-sm">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </td>
                  {tiers.map(tier => (
                    <td key={`${tier.id}-${feature.id}`} className="text-center p-4">
                      {tierHasFeature(tier, feature.id) ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// PRICING FAQ
// ============================================================================
export const PricingFAQ = ({ 
  items = FAQ_ITEMS,
  className 
}) => {
  return (
    <Accordion type="single" collapsible className={cn("w-full", className)}>
      {items.map((item, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="text-left">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

// ============================================================================
// TRUST BADGES
// ============================================================================
export const TrustBadges = ({ 
  badges = TRUST_BADGES,
  className 
}) => {
  return (
    <div className={cn("flex flex-wrap justify-center gap-6", className)}>
      {badges.map((badge, index) => {
        const IconComponent = iconMap[badge.icon] || Shield;
        return (
          <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
            <IconComponent className="h-4 w-4" />
            <span>{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// FULL PRICING SECTION
// ============================================================================
export const PricingSection = ({
  tiers = PRICING_TIERS,
  categories = FEATURE_CATEGORIES,
  faqItems = FAQ_ITEMS,
  currentTierId,
  onSelectPlan,
  showComparison = true,
  showFAQ = true,
  showTrustBadges = true,
  title = 'Choose Your Plan',
  subtitle = 'Flexible pricing that scales with your organization.',
  className
}) => {
  const [billingCycle, setBillingCycle] = useState('annual');
  
  return (
    <div className={cn("max-w-7xl mx-auto px-4 py-8", className)} data-testid="pricing-section">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {subtitle}
        </p>
        
        <PricingToggle 
          value={billingCycle} 
          onChange={setBillingCycle}
          className="mt-8"
        />
      </div>
      
      {/* Pricing Grid */}
      <PricingGrid
        tiers={tiers}
        billingCycle={billingCycle}
        currentTierId={currentTierId}
        onSelect={onSelectPlan}
      />
      
      {/* Trust Badges */}
      {showTrustBadges && (
        <TrustBadges className="mt-12" />
      )}
      
      {/* Comparison Table */}
      {showComparison && (
        <div className="mt-16">
          <h3 className="text-2xl font-semibold text-center mb-8">
            Compare Features
          </h3>
          <Card className="bg-card/50">
            <CardContent className="p-0">
              <PricingComparison tiers={tiers} categories={categories} />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* FAQ */}
      {showFAQ && (
        <div className="mt-16 max-w-3xl mx-auto">
          <h3 className="text-2xl font-semibold text-center mb-8">
            Frequently Asked Questions
          </h3>
          <PricingFAQ items={faqItems} />
        </div>
      )}
    </div>
  );
};

export default PricingSection;
