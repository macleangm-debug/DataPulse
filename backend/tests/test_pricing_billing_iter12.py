"""
Pricing & Billing API Tests - Iteration 12
Tests for pricing tiers, checkout sessions, subscriptions
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Module: Pricing Plans API Tests
class TestPricingPlans:
    """Tests for GET /api/pricing/plans and GET /api/pricing/plans/{tier_id}"""
    
    def test_get_all_plans_returns_4_tiers(self):
        """Verify /api/pricing/plans returns all 4 pricing tiers"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 4, f"Expected 4 plans, got {len(plans)}"
        
        # Verify tier IDs
        tier_ids = [p["id"] for p in plans]
        assert "free" in tier_ids
        assert "starter" in tier_ids
        assert "pro" in tier_ids
        assert "enterprise" in tier_ids
    
    def test_get_all_plans_includes_annual_discount(self):
        """Verify plans response includes annual discount percentage"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "annual_discount_percent" in data
        assert data["annual_discount_percent"] == 20
    
    def test_free_tier_has_correct_price(self):
        """Verify Free tier has $0 pricing"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        free_plan = next((p for p in data["plans"] if p["id"] == "free"), None)
        assert free_plan is not None
        assert free_plan["monthly_price"] == 0
        assert free_plan["annual_price"] == 0
        assert free_plan["name"] == "Free"
    
    def test_starter_tier_has_correct_pricing(self):
        """Verify Starter tier has $29/mo pricing"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        starter_plan = next((p for p in data["plans"] if p["id"] == "starter"), None)
        assert starter_plan is not None
        assert starter_plan["monthly_price"] == 29.0
        assert starter_plan["annual_price"] == 278.4  # 29 * 12 * 0.8
        assert starter_plan["name"] == "Starter"
    
    def test_pro_tier_has_correct_pricing(self):
        """Verify Professional tier has $79/mo pricing"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        pro_plan = next((p for p in data["plans"] if p["id"] == "pro"), None)
        assert pro_plan is not None
        assert pro_plan["monthly_price"] == 79.0
        assert pro_plan["annual_price"] == 758.4  # 79 * 12 * 0.8
        assert pro_plan["name"] == "Professional"
        assert pro_plan["popular"] == True  # Pro is marked as popular
    
    def test_enterprise_tier_has_correct_pricing(self):
        """Verify Enterprise tier has $249/mo pricing"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        enterprise_plan = next((p for p in data["plans"] if p["id"] == "enterprise"), None)
        assert enterprise_plan is not None
        assert enterprise_plan["monthly_price"] == 249.0
        assert enterprise_plan["annual_price"] == 2390.4  # 249 * 12 * 0.8
        assert enterprise_plan["name"] == "Enterprise"
    
    def test_plans_have_features(self):
        """Verify all plans have features object"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans")
        assert response.status_code == 200
        
        data = response.json()
        for plan in data["plans"]:
            assert "features" in plan
            features = plan["features"]
            assert "users" in features
            assert "projects" in features
            assert "forms" in features
            assert "submissions_per_month" in features
            assert "storage_gb" in features
    
    def test_get_specific_plan_details(self):
        """Verify GET /api/pricing/plans/{tier_id} returns plan details"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans/pro")
        assert response.status_code == 200
        
        data = response.json()
        assert "plan" in data
        assert data["plan"]["id"] == "pro"
        assert "feature_flags" in data
        assert "limits" in data
    
    def test_get_invalid_plan_returns_404(self):
        """Verify invalid tier_id returns 404"""
        response = requests.get(f"{BASE_URL}/api/pricing/plans/invalid_tier")
        assert response.status_code == 404


# Module: Checkout Session API Tests
class TestCheckoutCreate:
    """Tests for POST /api/pricing/checkout/create"""
    
    def test_create_checkout_session_for_starter(self):
        """Verify checkout session created for Starter tier"""
        payload = {
            "tier_id": "starter",
            "billing_period": "monthly",
            "origin_url": BASE_URL,
            "user_email": f"TEST_checkout_{uuid.uuid4().hex[:8]}@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert "transaction_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
    
    def test_create_checkout_session_for_pro(self):
        """Verify checkout session created for Pro tier"""
        payload = {
            "tier_id": "pro",
            "billing_period": "annual",
            "origin_url": BASE_URL,
            "user_email": f"TEST_checkout_{uuid.uuid4().hex[:8]}@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
    
    def test_create_checkout_for_enterprise(self):
        """Verify checkout session created for Enterprise tier"""
        payload = {
            "tier_id": "enterprise",
            "billing_period": "monthly",
            "origin_url": BASE_URL,
            "user_email": f"TEST_checkout_{uuid.uuid4().hex[:8]}@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
    
    def test_checkout_for_free_tier_returns_400(self):
        """Verify checkout for free tier returns error"""
        payload = {
            "tier_id": "free",
            "billing_period": "monthly",
            "origin_url": BASE_URL,
            "user_email": "TEST_free@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        assert "Free tier" in data["detail"]
    
    def test_checkout_invalid_tier_returns_400(self):
        """Verify invalid tier_id returns 400"""
        payload = {
            "tier_id": "invalid_tier",
            "billing_period": "monthly",
            "origin_url": BASE_URL,
            "user_email": "TEST_invalid@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 400
    
    def test_checkout_invalid_billing_period_returns_400(self):
        """Verify invalid billing period returns 400"""
        payload = {
            "tier_id": "starter",
            "billing_period": "weekly",  # Invalid
            "origin_url": BASE_URL,
            "user_email": "TEST_invalid_period@example.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        assert response.status_code == 400


# Module: Free Tier Subscription API Tests
class TestFreeSubscription:
    """Tests for POST /api/pricing/subscribe/free"""
    
    def test_subscribe_to_free_tier(self):
        """Verify user can subscribe to free tier"""
        unique_email = f"TEST_free_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/pricing/subscribe/free?user_email={unique_email}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "subscription_id" in data
        assert data["tier_id"] == "free"
        assert data["tier_name"] == "Free"
        assert "message" in data
    
    def test_duplicate_free_subscription_returns_400(self):
        """Verify duplicate subscription returns error"""
        unique_email = f"TEST_duplicate_{uuid.uuid4().hex[:8]}@example.com"
        
        # First subscription
        response1 = requests.post(
            f"{BASE_URL}/api/pricing/subscribe/free?user_email={unique_email}"
        )
        assert response1.status_code == 200
        
        # Duplicate subscription attempt
        response2 = requests.post(
            f"{BASE_URL}/api/pricing/subscribe/free?user_email={unique_email}"
        )
        assert response2.status_code == 400
        
        data = response2.json()
        assert "detail" in data
        assert "Already subscribed" in data["detail"]


# Module: Subscription Query API Tests
class TestSubscriptionQuery:
    """Tests for GET /api/pricing/subscription"""
    
    def test_get_subscription_for_subscribed_user(self):
        """Verify subscription details returned for subscribed user"""
        unique_email = f"TEST_subquery_{uuid.uuid4().hex[:8]}@example.com"
        
        # First subscribe
        requests.post(f"{BASE_URL}/api/pricing/subscribe/free?user_email={unique_email}")
        
        # Query subscription
        response = requests.get(
            f"{BASE_URL}/api/pricing/subscription?user_email={unique_email}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_subscription"] == True
        assert "subscription" in data
        assert data["subscription"]["user_email"] == unique_email
        assert data["subscription"]["tier_id"] == "free"
        assert "tier_details" in data
        assert "feature_flags" in data
        assert "limits" in data
    
    def test_get_subscription_for_non_subscribed_user(self):
        """Verify no subscription response for new user"""
        unique_email = f"TEST_nosub_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.get(
            f"{BASE_URL}/api/pricing/subscription?user_email={unique_email}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_subscription"] == False
        assert "message" in data


# Module: Checkout Status API Tests  
class TestCheckoutStatus:
    """Tests for GET /api/pricing/checkout/status/{session_id}"""
    
    def test_get_checkout_status_for_valid_session(self):
        """Verify checkout status returned for valid session"""
        # Create a checkout session first
        payload = {
            "tier_id": "starter",
            "billing_period": "monthly",
            "origin_url": BASE_URL,
            "user_email": f"TEST_status_{uuid.uuid4().hex[:8]}@example.com"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/pricing/checkout/create",
            json=payload
        )
        session_id = create_response.json()["session_id"]
        
        # Check status
        response = requests.get(
            f"{BASE_URL}/api/pricing/checkout/status/{session_id}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "payment_status" in data
        assert "tier_id" in data
    
    def test_get_checkout_status_invalid_session_returns_404(self):
        """Verify invalid session_id returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/pricing/checkout/status/invalid_session_id"
        )
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
