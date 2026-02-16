/**
 * DataPulse - Pricing Examples
 * 6 Ready-to-use pricing page implementations
 */

import React, { useState } from 'react';
import { 
  PricingSection, 
  PricingCard, 
  PricingGrid, 
  PricingToggle,
  PricingComparison,
  PricingFAQ,
  TrustBadges
} from './PricingComponents';
import { 
  PRICING_TIERS, 
  FEATURE_CATEGORIES, 
  FAQ_ITEMS 
} from './PricingConfig';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Crown } from 'lucide-react';

// ============================================================================
// EXAMPLE 1: Full Pricing Page
// ============================================================================
export const FullPricingPage = () => {
  const handleSelectPlan = (tier) => {
    console.log('Selected plan:', tier.name);
    // Implement your checkout logic here
  };

  return (
    <div className="min-h-screen bg-background">
      <PricingSection
        onSelectPlan={handleSelectPlan}
        showComparison={true}
        showFAQ={true}
        showTrustBadges={true}
      />
    </div>
  );
};

// ============================================================================
// EXAMPLE 2: Landing Page Section (Compact)
// ============================================================================
export const LandingPagePricing = () => {
  const [billing, setBilling] = useState('annual');

  return (
    <section className="py-20 bg-background">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">Start free. Upgrade as you grow.</p>
          <PricingToggle value={billing} onChange={setBilling} className="mt-6" />
        </div>
        
        <PricingGrid
          tiers={PRICING_TIERS}
          billingCycle={billing}
          columns={4}
          onSelect={(tier) => console.log('Selected:', tier.name)}
        />
        
        <TrustBadges className="mt-10" />
      </div>
    </section>
  );
};

// ============================================================================
// EXAMPLE 3: Dark Theme Pricing
// ============================================================================
export const DarkThemePricing = () => {
  return (
    <div className="dark bg-slate-950 min-h-screen py-16">
      <PricingSection
        title="Power Your Business"
        subtitle="Enterprise-grade features at startup-friendly prices."
        showComparison={false}
        showFAQ={true}
        showTrustBadges={true}
      />
    </div>
  );
};

// ============================================================================
// EXAMPLE 4: Light Theme Pricing
// ============================================================================
export const LightThemePricing = () => {
  return (
    <div className="bg-white min-h-screen py-16">
      <PricingSection
        title="Find Your Perfect Plan"
        subtitle="No hidden fees. Cancel anytime."
        showComparison={true}
        showFAQ={false}
      />
    </div>
  );
};

// ============================================================================
// EXAMPLE 5: Minimal 3-Tier Pricing
// ============================================================================
export const MinimalPricing = () => {
  const [billing, setBilling] = useState('annual');
  // Use only 3 tiers for simpler display
  const threeTiers = PRICING_TIERS.filter(t => ['free', 'pro', 'enterprise'].includes(t.id));

  return (
    <div className="py-16 px-4">
      <div className="max-w-4xl mx-auto text-center mb-10">
        <h2 className="text-2xl font-bold mb-2">Pick a Plan</h2>
        <PricingToggle value={billing} onChange={setBilling} showBadge={true} />
      </div>
      
      <PricingGrid
        tiers={threeTiers}
        billingCycle={billing}
        columns={3}
      />
    </div>
  );
};

// ============================================================================
// EXAMPLE 6: Individual Components Demo
// ============================================================================
export const ComponentsDemo = () => {
  const [billing, setBilling] = useState('monthly');
  const proTier = PRICING_TIERS.find(t => t.id === 'pro');

  return (
    <div className="p-8 space-y-12">
      {/* Toggle Only */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Billing Toggle</h3>
        <PricingToggle value={billing} onChange={setBilling} />
        <p className="text-sm text-muted-foreground mt-2">Selected: {billing}</p>
      </section>

      {/* Single Card */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Single Pricing Card</h3>
        <div className="max-w-sm">
          <PricingCard
            tier={proTier}
            billingCycle={billing}
            onSelect={(t) => alert(`Selected: ${t.name}`)}
          />
        </div>
      </section>

      {/* Comparison Table */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Feature Comparison</h3>
        <Card>
          <CardContent className="p-0">
            <PricingComparison tiers={PRICING_TIERS.slice(0, 3)} />
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h3 className="text-lg font-semibold mb-4">FAQ Section</h3>
        <div className="max-w-2xl">
          <PricingFAQ items={FAQ_ITEMS.slice(0, 4)} />
        </div>
      </section>

      {/* Trust Badges */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Trust Badges</h3>
        <TrustBadges />
      </section>
    </div>
  );
};

// ============================================================================
// EXAMPLE 7: Custom Styled Pricing
// ============================================================================
export const CustomStyledPricing = () => {
  const [billing, setBilling] = useState('annual');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 py-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header with custom styling */}
        <div className="text-center mb-12">
          <span className="px-4 py-1 bg-white/10 rounded-full text-sm text-white/80 mb-4 inline-block">
            Pricing Plans
          </span>
          <h2 className="text-4xl font-bold text-white mb-4">
            Scale Without Limits
          </h2>
          <p className="text-white/60 max-w-xl mx-auto">
            Join thousands of teams building the future with our platform.
          </p>
          
          <div className="mt-8 inline-flex items-center gap-4 bg-white/10 rounded-full p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-full text-sm transition ${
                billing === 'monthly' ? 'bg-white text-purple-900' : 'text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 py-2 rounded-full text-sm transition ${
                billing === 'annual' ? 'bg-white text-purple-900' : 'text-white'
              }`}
            >
              Annual <span className="text-xs text-green-400 ml-1">-20%</span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <PricingGrid
          tiers={PRICING_TIERS}
          billingCycle={billing}
          columns={4}
        />

        {/* Enterprise CTA */}
        <div className="mt-16 text-center">
          <Card className="bg-white/5 border-white/10 max-w-2xl mx-auto backdrop-blur">
            <CardContent className="py-8">
              <Crown className="h-10 w-10 text-amber-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Need More?</h3>
              <p className="text-white/60 mb-4">
                Contact us for custom enterprise solutions.
              </p>
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                Talk to Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Export all examples
export default {
  FullPricingPage,
  LandingPagePricing,
  DarkThemePricing,
  LightThemePricing,
  MinimalPricing,
  ComponentsDemo,
  CustomStyledPricing,
};
