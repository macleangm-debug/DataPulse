/**
 * DataPulse Pricing Page
 * Competitive pricing with storage limits factored in
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Check, 
  X, 
  Zap, 
  Building2, 
  Users, 
  Rocket,
  HardDrive,
  Database,
  Brain,
  Globe,
  Shield,
  Headphones,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';

// Pricing tiers with storage included
const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for students and small pilots',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Zap,
    color: 'slate',
    popular: false,
    limits: {
      submissions: '500/month',
      storage: '1 GB',
      teamMembers: '1 user',
      forms: '3 forms',
      projects: '1 project'
    },
    features: [
      { name: 'Offline data collection', included: true },
      { name: 'GPS & location capture', included: true },
      { name: 'Photo capture', included: true },
      { name: 'Basic export (CSV)', included: true },
      { name: '6 languages supported', included: true },
      { name: 'Audio/Video recording', included: false },
      { name: 'AI Transcription', included: false },
      { name: 'Review workflows', included: false },
      { name: 'Real-time dashboards', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Get Started Free',
    ctaVariant: 'outline'
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams and NGOs',
    monthlyPrice: 29,
    yearlyPrice: 290, // ~17% discount
    icon: Users,
    color: 'blue',
    popular: false,
    limits: {
      submissions: '5,000/month',
      storage: '10 GB',
      teamMembers: '5 users',
      forms: '10 forms',
      projects: '3 projects'
    },
    features: [
      { name: 'Offline data collection', included: true },
      { name: 'GPS & Geofencing', included: true },
      { name: 'Photo/Audio/Video capture', included: true },
      { name: 'Advanced export (Excel, JSON)', included: true },
      { name: '6 languages supported', included: true },
      { name: 'AI Transcription', included: true, limit: '100/month' },
      { name: 'Basic dashboards', included: true },
      { name: 'Email support', included: true },
      { name: 'Review workflows', included: false },
      { name: 'API access', included: false },
    ],
    cta: 'Start Free Trial',
    ctaVariant: 'default'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For research organizations',
    monthlyPrice: 99,
    yearlyPrice: 990, // ~17% discount
    icon: Rocket,
    color: 'cyan',
    popular: true,
    limits: {
      submissions: '25,000/month',
      storage: '100 GB',
      teamMembers: '25 users',
      forms: 'Unlimited',
      projects: 'Unlimited'
    },
    features: [
      { name: 'Everything in Starter', included: true },
      { name: 'AI Transcription', included: true, limit: '1,000/month' },
      { name: 'AI Sentiment Analysis', included: true },
      { name: 'Advanced dashboards & widgets', included: true },
      { name: 'Review workflows', included: true },
      { name: 'Data quality AI', included: true },
      { name: 'API access', included: true },
      { name: 'Priority email support', included: true },
      { name: 'Scheduled exports', included: true },
      { name: 'SSO/SAML', included: false },
    ],
    cta: 'Start Free Trial',
    ctaVariant: 'default'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large-scale deployments',
    monthlyPrice: 299,
    yearlyPrice: 2990, // ~17% discount
    icon: Building2,
    color: 'purple',
    popular: false,
    limits: {
      submissions: 'Unlimited',
      storage: '1 TB',
      teamMembers: 'Unlimited',
      forms: 'Unlimited',
      projects: 'Unlimited'
    },
    features: [
      { name: 'Everything in Professional', included: true },
      { name: 'Unlimited AI Transcription', included: true },
      { name: 'Custom AI models', included: true },
      { name: 'Custom dashboards', included: true },
      { name: 'SSO/SAML authentication', included: true },
      { name: 'Custom branding', included: true },
      { name: 'Dedicated support', included: true },
      { name: 'On-premise deployment option', included: true },
      { name: 'SLA guarantee (99.9%)', included: true },
      { name: 'Custom integrations', included: true },
    ],
    cta: 'Contact Sales',
    ctaVariant: 'default'
  }
];

// Storage add-on pricing
const STORAGE_ADDONS = [
  { gb: 50, price: 10, label: '+50 GB' },
  { gb: 100, price: 18, label: '+100 GB' },
  { gb: 500, price: 75, label: '+500 GB' },
  { gb: 1000, price: 120, label: '+1 TB' },
];

// FAQ items
const FAQ_ITEMS = [
  {
    question: 'What counts towards storage?',
    answer: 'Storage includes all media files (photos, audio, video recordings, signatures, file uploads) and form attachments. Text responses and metadata use minimal storage and are not counted against your limit.'
  },
  {
    question: 'What happens if I exceed my storage limit?',
    answer: 'You\'ll receive a notification at 80% usage. Once at 100%, new media uploads will be paused until you upgrade or purchase additional storage. Text-only submissions will continue to work.'
  },
  {
    question: 'Can I purchase additional storage?',
    answer: 'Yes! You can add storage to any paid plan. Additional storage starts at $10/month for 50GB. Volume discounts are available for Enterprise customers.'
  },
  {
    question: 'How are AI transcription credits calculated?',
    answer: 'Each audio file transcribed counts as 1 credit, regardless of length. Unused credits roll over for up to 3 months on annual plans.'
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! All paid plans include a 14-day free trial with full access to features. No credit card required to start.'
  },
  {
    question: 'Can I switch plans anytime?',
    answer: 'Absolutely. Upgrade anytime and pay the prorated difference. Downgrade at the end of your billing cycle. Your data is always preserved.'
  }
];

// Pricing card component
const PricingCard = ({ tier, isYearly, onSelect }) => {
  const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
  const monthlyEquivalent = isYearly ? Math.round(tier.yearlyPrice / 12) : tier.monthlyPrice;
  const Icon = tier.icon;
  
  const colorClasses = {
    slate: 'border-slate-200 dark:border-slate-700',
    blue: 'border-blue-200 dark:border-blue-700',
    cyan: 'border-cyan-500 ring-2 ring-cyan-500/20',
    purple: 'border-purple-200 dark:border-purple-700',
  };
  
  const iconBgClasses = {
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "relative h-full flex flex-col transition-all duration-300 hover:shadow-lg",
        colorClasses[tier.color],
        tier.popular && "scale-105 shadow-xl"
      )}>
        {tier.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-cyan-500 text-white px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              Most Popular
            </Badge>
          </div>
        )}
        
        <CardHeader className="pb-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", iconBgClasses[tier.color])}>
            <Icon className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">{tier.name}</CardTitle>
          <CardDescription>{tier.description}</CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col">
          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">${monthlyEquivalent}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            {isYearly && tier.monthlyPrice > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                Save ${(tier.monthlyPrice * 12) - tier.yearlyPrice}/year
              </p>
            )}
            {isYearly && tier.yearlyPrice > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Billed ${tier.yearlyPrice}/year
              </p>
            )}
          </div>
          
          {/* Limits */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Database className="w-4 h-4" />
                Submissions
              </span>
              <span className="font-medium">{tier.limits.submissions}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <HardDrive className="w-4 h-4" />
                Storage
              </span>
              <span className="font-medium text-cyan-600 dark:text-cyan-400">{tier.limits.storage}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4" />
                Team
              </span>
              <span className="font-medium">{tier.limits.teamMembers}</span>
            </div>
          </div>
          
          {/* Features */}
          <div className="space-y-3 mb-6 flex-1">
            {tier.features.map((feature, idx) => (
              <div key={idx} className="flex items-start gap-2">
                {feature.included ? (
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-slate-300 dark:text-slate-600 mt-0.5 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-sm",
                  feature.included ? "text-foreground" : "text-muted-foreground"
                )}>
                  {feature.name}
                  {feature.limit && (
                    <span className="text-xs text-muted-foreground ml-1">({feature.limit})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <Button 
            className={cn(
              "w-full",
              tier.popular && "bg-cyan-500 hover:bg-cyan-600"
            )}
            variant={tier.ctaVariant}
            onClick={() => onSelect(tier)}
          >
            {tier.cta}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Storage calculator component
const StorageCalculator = () => {
  const [photos, setPhotos] = useState(100);
  const [audioMinutes, setAudioMinutes] = useState(30);
  const [videoMinutes, setVideoMinutes] = useState(10);
  
  // Estimate: Photo ~2MB, Audio ~1MB/min, Video ~10MB/min
  const estimatedGB = ((photos * 2) + (audioMinutes * 1) + (videoMinutes * 10)) / 1024;
  
  return (
    <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-cyan-500" />
          Storage Calculator
        </CardTitle>
        <CardDescription>Estimate your monthly storage needs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Photos per month: {photos}</label>
          <input 
            type="range" 
            min="0" 
            max="1000" 
            value={photos} 
            onChange={(e) => setPhotos(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <p className="text-xs text-muted-foreground mt-1">~2 MB per photo</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Audio (minutes): {audioMinutes}</label>
          <input 
            type="range" 
            min="0" 
            max="500" 
            value={audioMinutes} 
            onChange={(e) => setAudioMinutes(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <p className="text-xs text-muted-foreground mt-1">~1 MB per minute</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Video (minutes): {videoMinutes}</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={videoMinutes} 
            onChange={(e) => setVideoMinutes(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <p className="text-xs text-muted-foreground mt-1">~10 MB per minute</p>
        </div>
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-medium">Estimated Monthly Storage:</span>
            <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {estimatedGB.toFixed(1)} GB
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {estimatedGB < 1 && "Free plan covers your needs!"}
            {estimatedGB >= 1 && estimatedGB < 10 && "Starter plan recommended"}
            {estimatedGB >= 10 && estimatedGB < 100 && "Professional plan recommended"}
            {estimatedGB >= 100 && "Enterprise plan recommended"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default function PricingPage() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  
  const handleSelectPlan = (tier) => {
    if (tier.id === 'enterprise') {
      // Could open a contact form modal
      window.location.href = 'mailto:sales@datapulse.io?subject=Enterprise%20Inquiry';
    } else {
      navigate('/register', { state: { plan: tier.id } });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">
                Data<span className="text-cyan-600 dark:text-cyan-400">Pulse</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/login')}>Log In</Button>
              <Button onClick={() => navigate('/register')}>Start Free Trial</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
            Simple, Transparent Pricing
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Choose the plan that fits your
            <span className="text-cyan-600 dark:text-cyan-400"> research needs</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            All plans include offline data collection, GPS capture, and multi-language support.
            Scale as your project grows with transparent pricing and no hidden fees.
          </p>
          
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={cn("text-sm font-medium", !isYearly && "text-foreground")}>Monthly</span>
            <Switch 
              checked={isYearly} 
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-cyan-500"
            />
            <span className={cn("text-sm font-medium", isYearly && "text-foreground")}>
              Yearly
              <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Save 17%
              </Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map((tier) => (
              <PricingCard 
                key={tier.id} 
                tier={tier} 
                isYearly={isYearly}
                onSelect={handleSelectPlan}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Storage Section */}
      <section className="py-16 px-4 bg-slate-100 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              <HardDrive className="w-8 h-8 inline-block mr-2 text-cyan-500" />
              Storage That Scales With You
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every plan includes generous storage for your media files. Need more? 
              Add storage anytime without changing plans.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Storage Add-ons */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Storage Packs</CardTitle>
                <CardDescription>Add to any paid plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {STORAGE_ADDONS.map((addon) => (
                    <div 
                      key={addon.gb}
                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 text-center hover:border-cyan-500 transition-colors cursor-pointer"
                    >
                      <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{addon.label}</p>
                      <p className="text-sm text-muted-foreground">${addon.price}/month</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Volume discounts available for Enterprise customers
                </p>
              </CardContent>
            </Card>
            
            {/* Calculator */}
            <StorageCalculator />
          </div>
        </div>
      </section>

      {/* Comparison vs SurveyCTO */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why DataPulse Over SurveyCTO?</h2>
            <p className="text-muted-foreground">More features, better pricing, AI-powered</p>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left p-4">Feature</th>
                    <th className="text-center p-4">
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold">DataPulse</span>
                      <br />
                      <span className="text-xs text-muted-foreground">$99/mo</span>
                    </th>
                    <th className="text-center p-4">
                      <span className="text-slate-500">SurveyCTO</span>
                      <br />
                      <span className="text-xs text-muted-foreground">$149/mo</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Monthly Submissions', datapulse: '25,000', competitor: '10,000' },
                    { feature: 'Storage Included', datapulse: '100 GB', competitor: '5 GB' },
                    { feature: 'AI Transcription', datapulse: '1,000/mo', competitor: '—' },
                    { feature: 'AI Sentiment Analysis', datapulse: '✓', competitor: '—' },
                    { feature: 'Real-time Dashboards', datapulse: 'Advanced', competitor: 'Basic' },
                    { feature: 'Review Workflows', datapulse: '✓', competitor: '✓' },
                    { feature: 'Data Quality AI', datapulse: '✓', competitor: '—' },
                    { feature: 'Languages', datapulse: '6', competitor: '2' },
                    { feature: 'API Access', datapulse: '✓', competitor: '✓' },
                  ].map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="p-4 text-center text-cyan-600 dark:text-cyan-400 font-medium">{row.datapulse}</td>
                      <td className="p-4 text-center text-muted-foreground">{row.competitor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq, idx) => (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to transform your data collection?</h2>
          <p className="text-lg text-cyan-100 mb-8">Start your 14-day free trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/register')}
              className="bg-white text-cyan-600 hover:bg-cyan-50"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/demo')}
              className="border-white text-white hover:bg-white/10"
            >
              Try Interactive Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-500" />
            <span className="font-bold">DataPulse</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 DataPulse. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
