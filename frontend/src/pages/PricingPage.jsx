import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store';
import DashboardLayout from '../layouts/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { 
  Check, 
  X, 
  Zap, 
  Users, 
  HardDrive, 
  Mail, 
  Star,
  Crown,
  Rocket,
  Building2,
  Loader2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Tier icons mapping
const tierIcons = {
  free: Zap,
  starter: Rocket,
  pro: Star,
  enterprise: Crown
};

// Tier colors mapping
const tierColors = {
  free: 'from-slate-500 to-slate-600',
  starter: 'from-blue-500 to-blue-600',
  pro: 'from-purple-500 to-purple-600',
  enterprise: 'from-amber-500 to-amber-600'
};

const PricingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const [plans, setPlans] = useState([]);
  const [isAnnual, setIsAnnual] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  
  // Check if returning from successful payment
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    fetchPlans();
    if (isAuthenticated && user?.email) {
      fetchCurrentSubscription();
    }
  }, [isAuthenticated, user]);
  
  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [sessionId]);
  
  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pricing/plans`);
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pricing/subscription?user_email=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.has_subscription) {
          setCurrentSubscription(data.subscription);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };
  
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;
    
    if (attempts >= maxAttempts) {
      toast.error('Payment verification timed out. Please check your email for confirmation.');
      navigate('/pricing', { replace: true });
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/pricing/checkout/status/${sessionId}`);
      if (!response.ok) throw new Error('Failed to check status');
      
      const data = await response.json();
      
      if (data.payment_status === 'paid') {
        toast.success(`Successfully subscribed to ${data.tier_name} plan!`);
        fetchCurrentSubscription();
        navigate('/pricing', { replace: true });
        return;
      } else if (data.status === 'expired') {
        toast.error('Payment session expired. Please try again.');
        navigate('/pricing', { replace: true });
        return;
      }
      
      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    }
  };
  
  const handleSelectPlan = async (plan) => {
    if (!isAuthenticated) {
      toast.info('Please login to subscribe');
      navigate('/login');
      return;
    }
    
    // Free tier
    if (plan.id === 'free') {
      try {
        const response = await fetch(`${API_URL}/api/pricing/subscribe/free?user_email=${encodeURIComponent(user.email)}`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to subscribe');
        }
        
        toast.success('Successfully subscribed to Free plan!');
        fetchCurrentSubscription();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }
    
    // Paid tiers
    setCheckingOut(plan.id);
    
    try {
      const response = await fetch(`${API_URL}/api/pricing/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: plan.id,
          billing_period: isAnnual ? 'annual' : 'monthly',
          origin_url: window.location.origin,
          user_email: user.email
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout');
      }
      
      const data = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = data.checkout_url;
    } catch (error) {
      toast.error(error.message);
      setCheckingOut(null);
    }
  };
  
  const formatPrice = (plan) => {
    if (plan.id === 'free') return '$0';
    const price = isAnnual ? plan.annual_monthly_equivalent : plan.monthly_price;
    return `$${price.toFixed(0)}`;
  };
  
  const formatFeatureValue = (value) => {
    if (value === -1) return 'Unlimited';
    if (typeof value === 'number') return value.toLocaleString();
    return value;
  };
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8" data-testid="pricing-page">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Flexible pricing that scales with your organization. Start free and upgrade as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              data-testid="billing-toggle"
            />
            <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                Save 20%
              </Badge>
            )}
          </div>
        </div>
        
        {/* Current Subscription Badge */}
        {currentSubscription && (
          <div className="mb-8 flex justify-center">
            <Badge variant="outline" className="text-base px-4 py-2 border-purple-500/50 bg-purple-500/10">
              <Check className="h-4 w-4 mr-2 text-green-500" />
              Current Plan: <span className="font-semibold ml-1">{currentSubscription.tier_name}</span>
            </Badge>
          </div>
        )}
        
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const TierIcon = tierIcons[plan.id] || Zap;
            const isCurrentPlan = currentSubscription?.tier_id === plan.id;
            const isPopular = plan.popular;
            
            return (
              <Card 
                key={plan.id}
                className={`relative flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 ${
                  isPopular ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-border/50'
                } ${isCurrentPlan ? 'ring-2 ring-green-500/50' : ''}`}
                data-testid={`pricing-card-${plan.id}`}
              >
                {/* Popular Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className={`bg-gradient-to-r ${tierColors[plan.id]} text-white border-0`}>
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tierColors[plan.id]} p-2.5 mx-auto mb-3`}>
                    <TierIcon className="w-full h-full text-white" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">{formatPrice(plan)}</span>
                      {plan.id !== 'free' && (
                        <span className="text-muted-foreground">/mo</span>
                      )}
                    </div>
                    {plan.id !== 'free' && isAnnual && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Billed annually (${plan.annual_price.toFixed(0)}/year)
                      </p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Key Limits */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{formatFeatureValue(plan.features.users)} users</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span>{formatFeatureValue(plan.features.storage_gb)} GB storage</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{formatFeatureValue(plan.features.emails_per_month)} emails/mo</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{formatFeatureValue(plan.features.submissions_per_month)} submissions/mo</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Included Features */}
                  <div className="space-y-2">
                    {plan.included_features.slice(0, 6).map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                    {plan.included_features.length > 6 && (
                      <p className="text-xs text-muted-foreground pl-6">
                        +{plan.included_features.length - 6} more features
                      </p>
                    )}
                  </div>
                  
                  {/* Excluded Features (for lower tiers) */}
                  {plan.excluded_features.length > 0 && (
                    <div className="space-y-2 opacity-60">
                      {plan.excluded_features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                
                <CardFooter>
                  <Button
                    className={`w-full ${isPopular ? `bg-gradient-to-r ${tierColors[plan.id]} hover:opacity-90` : ''}`}
                    variant={isPopular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || checkingOut === plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    data-testid={`select-plan-${plan.id}`}
                  >
                    {checkingOut === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : (
                      <>
                        {plan.id === 'free' ? 'Get Started' : 'Subscribe'}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        
        {/* FAQ / Additional Info */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Can I change plans later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">What happens if I exceed limits?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  We'll notify you when approaching limits. Overage charges apply for submissions, storage, and emails beyond your plan.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-base">Is there a free trial?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Our Free plan lets you try DataPulse with no time limit. Upgrade when you're ready for more features.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Enterprise CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 max-w-2xl mx-auto">
            <CardContent className="py-8">
              <Crown className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Need a custom solution?</h3>
              <p className="text-muted-foreground mb-4">
                Contact us for custom pricing, dedicated support, and enterprise features.
              </p>
              <Button variant="outline" className="border-amber-500/50 hover:bg-amber-500/10">
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PricingPage;
