/**
 * DataPulse - Pricing Configuration
 * Customizable pricing tiers, features, and FAQ data
 */

// ============================================================================
// PRICING TIERS (80% margin structure)
// ============================================================================
export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    monthlyPrice: 0,
    annualPrice: 0,
    icon: 'Zap',
    color: 'from-slate-500 to-slate-600',
    badge: null,
    popular: false,
    cta: 'Get Started',
    limits: {
      users: 2,
      storage: '0.5 GB',
      submissions: '100/mo',
      emails: '100/mo',
      projects: 1,
      forms: 3,
    },
    features: {
      'Core Features': ['basic_forms', 'submissions', 'basic_analytics'],
      'Data Collection': ['mobile_app'],
      'Support': ['community'],
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For small teams getting started',
    monthlyPrice: 29,
    annualPrice: 278.40,
    icon: 'Rocket',
    color: 'from-blue-500 to-blue-600',
    badge: null,
    popular: false,
    cta: 'Subscribe',
    limits: {
      users: 5,
      storage: '10 GB',
      submissions: '2,000/mo',
      emails: '5,000/mo',
      projects: 5,
      forms: 20,
    },
    features: {
      'Core Features': ['basic_forms', 'submissions', 'basic_analytics', 'api_access'],
      'Data Collection': ['mobile_app', 'offline_mode'],
      'Collaboration': ['team_members'],
      'Support': ['email'],
    },
  },
  {
    id: 'pro',
    name: 'Professional',
    description: 'For growing organizations',
    monthlyPrice: 79,
    annualPrice: 758.40,
    icon: 'Star',
    color: 'from-purple-500 to-purple-600',
    badge: 'Most Popular',
    popular: true,
    cta: 'Subscribe',
    limits: {
      users: 25,
      storage: '100 GB',
      submissions: '20,000/mo',
      emails: '25,000/mo',
      projects: 20,
      forms: 100,
    },
    features: {
      'Core Features': ['basic_forms', 'submissions', 'basic_analytics', 'api_access', 'advanced_analytics'],
      'Data Collection': ['mobile_app', 'offline_mode', 'gps_tracking', 'media_capture'],
      'Collaboration': ['team_members', 'roles_permissions'],
      'Support': ['priority_email'],
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with advanced needs',
    monthlyPrice: 249,
    annualPrice: 2390.40,
    icon: 'Crown',
    color: 'from-amber-500 to-amber-600',
    badge: 'Best Value',
    popular: false,
    cta: 'Contact Sales',
    limits: {
      users: 'Unlimited',
      storage: '1 TB',
      submissions: '100,000/mo',
      emails: '100,000/mo',
      projects: 'Unlimited',
      forms: 'Unlimited',
    },
    features: {
      'Core Features': ['basic_forms', 'submissions', 'basic_analytics', 'api_access', 'advanced_analytics', 'custom_branding'],
      'Data Collection': ['mobile_app', 'offline_mode', 'gps_tracking', 'media_capture'],
      'Collaboration': ['team_members', 'roles_permissions', 'audit_logs'],
      'Security': ['sso_saml', 'custom_domain', 'hipaa_gdpr'],
      'Support': ['dedicated_manager', 'sla_guarantee'],
    },
  },
];

// ============================================================================
// FEATURE CATEGORIES (for comparison table)
// ============================================================================
export const FEATURE_CATEGORIES = [
  {
    name: 'Core Features',
    features: [
      { id: 'basic_forms', label: 'Form Builder', description: 'Create custom forms' },
      { id: 'submissions', label: 'Data Collection', description: 'Collect responses' },
      { id: 'basic_analytics', label: 'Basic Analytics', description: 'View submission stats' },
      { id: 'api_access', label: 'API Access', description: 'Integrate with other tools' },
      { id: 'advanced_analytics', label: 'Advanced Analytics', description: 'Deep insights & reports' },
      { id: 'custom_branding', label: 'Custom Branding', description: 'White-label your forms' },
    ],
  },
  {
    name: 'Data Collection',
    features: [
      { id: 'mobile_app', label: 'Mobile App', description: 'Collect data on mobile' },
      { id: 'offline_mode', label: 'Offline Mode', description: 'Work without internet' },
      { id: 'gps_tracking', label: 'GPS Tracking', description: 'Location-based data' },
      { id: 'media_capture', label: 'Photo/Video Capture', description: 'Multimedia submissions' },
    ],
  },
  {
    name: 'Collaboration',
    features: [
      { id: 'team_members', label: 'Team Members', description: 'Invite collaborators' },
      { id: 'roles_permissions', label: 'Role-Based Access', description: 'Granular permissions' },
      { id: 'audit_logs', label: 'Audit Logs', description: 'Track all changes' },
    ],
  },
  {
    name: 'Security',
    features: [
      { id: 'sso_saml', label: 'SSO/SAML', description: 'Enterprise authentication' },
      { id: 'custom_domain', label: 'Custom Domain', description: 'Your own domain' },
      { id: 'hipaa_gdpr', label: 'HIPAA/GDPR', description: 'Compliance ready' },
    ],
  },
  {
    name: 'Support',
    features: [
      { id: 'community', label: 'Community Support', description: 'Forums & docs' },
      { id: 'email', label: 'Email Support', description: 'Direct assistance' },
      { id: 'priority_email', label: 'Priority Support', description: 'Faster response' },
      { id: 'dedicated_manager', label: 'Dedicated Manager', description: 'Personal contact' },
      { id: 'sla_guarantee', label: 'SLA Guarantee', description: '99.9% uptime' },
    ],
  },
];

// ============================================================================
// FAQ ITEMS
// ============================================================================
export const FAQ_ITEMS = [
  {
    question: 'Can I change plans later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any differences.',
  },
  {
    question: 'What happens if I exceed my limits?',
    answer: 'We\'ll notify you when you\'re approaching your limits. You can upgrade your plan or pay for overages at competitive rates.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Our Free plan lets you try DataPulse with no time limit. Upgrade when you\'re ready for more features and capacity.',
  },
  {
    question: 'How does annual billing work?',
    answer: 'With annual billing, you pay upfront for 12 months and save 20%. You can switch to monthly billing when your term ends.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, Amex) through our secure payment processor, Stripe.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes, you can cancel your subscription at any time. You\'ll retain access until the end of your billing period.',
  },
  {
    question: 'Do you offer discounts for nonprofits?',
    answer: 'Yes! Contact our sales team for special pricing for nonprofits, educational institutions, and NGOs.',
  },
];

// ============================================================================
// TRUST BADGES
// ============================================================================
export const TRUST_BADGES = [
  { label: 'SOC 2 Compliant', icon: 'Shield' },
  { label: 'GDPR Ready', icon: 'Lock' },
  { label: '99.9% Uptime', icon: 'Server' },
  { label: '256-bit Encryption', icon: 'Key' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate price based on billing cycle
 */
export const calculatePrice = (tier, billingCycle) => {
  if (billingCycle === 'annual') {
    return tier.annualPrice / 12;
  }
  return tier.monthlyPrice;
};

/**
 * Calculate total annual price
 */
export const calculateAnnualPrice = (tier) => {
  return tier.annualPrice;
};

/**
 * Get annual savings percentage
 */
export const getAnnualDiscount = () => 20;

/**
 * Check if tier has a specific feature
 */
export const tierHasFeature = (tier, featureId) => {
  return Object.values(tier.features).flat().includes(featureId);
};

/**
 * Get tier by ID
 */
export const getTierById = (tierId) => {
  return PRICING_TIERS.find(t => t.id === tierId);
};

/**
 * Format price for display
 */
export const formatPrice = (price) => {
  if (price === 0) return '$0';
  return `$${price.toFixed(0)}`;
};

/**
 * Format limit value
 */
export const formatLimit = (value) => {
  if (value === 'Unlimited' || value === -1) return 'Unlimited';
  return value;
};
