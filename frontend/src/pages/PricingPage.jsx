/**
 * DataPulse - Pricing Page
 * Uses reusable pricing components from /components/pricing/
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '../store';
import DashboardLayout from '../layouts/DashboardLayout';
import { PricingSection } from '../components/pricing';
import { Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PricingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
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
      
      // Transform API data to component format
      const transformedPlans = (data.plans || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        monthlyPrice: plan.monthly_price,
        annualPrice: plan.annual_price,
        icon: plan.id === 'free' ? 'Zap' : plan.id === 'starter' ? 'Rocket' : plan.id === 'pro' ? 'Star' : 'Crown',
        color: plan.id === 'free' ? 'from-slate-500 to-slate-600' : 
               plan.id === 'starter' ? 'from-blue-500 to-blue-600' :
               plan.id === 'pro' ? 'from-purple-500 to-purple-600' : 'from-amber-500 to-amber-600',
        badge: plan.badge,
        popular: plan.popular,
        cta: plan.id === 'free' ? 'Get Started' : 'Subscribe',
        limits: {
          users: plan.features.users === -1 ? 'Unlimited' : plan.features.users,
          storage: `${plan.features.storage_gb} GB`,
          submissions: `${plan.features.submissions_per_month.toLocaleString()}/mo`,
          emails: `${plan.features.emails_per_month.toLocaleString()}/mo`,
          projects: plan.features.projects === -1 ? 'Unlimited' : plan.features.projects,
          forms: plan.features.forms === -1 ? 'Unlimited' : plan.features.forms,
        },
        features: {
          'Core Features': plan.included_features.slice(0, 4).map((_, i) => `feature_${i}`),
        },
        included_features: plan.included_features,
        excluded_features: plan.excluded_features,
      }));
      
      setPlans(transformedPlans);
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
  
  const handleSelectPlan = async (tier) => {
    if (!isAuthenticated) {
      toast.info('Please login to subscribe');
      navigate('/login');
      return;
    }
    
    // Free tier
    if (tier.id === 'free') {
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
    
    // Paid tiers - redirect to Stripe checkout
    try {
      const response = await fetch(`${API_URL}/api/pricing/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: tier.id,
          billing_period: 'annual', // Default to annual for better value
          origin_url: window.location.origin,
          user_email: user.email
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout');
      }
      
      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (error) {
      toast.error(error.message);
    }
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
      <PricingSection
        tiers={plans}
        currentTierId={currentSubscription?.tier_id}
        onSelectPlan={handleSelectPlan}
        showComparison={false}
        showFAQ={true}
        showTrustBadges={true}
        title="Choose Your Plan"
        subtitle="Flexible pricing that scales with your organization. Start free and upgrade as you grow."
      />
    </DashboardLayout>
  );
};

export default PricingPage;
