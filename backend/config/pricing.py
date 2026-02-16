"""
DataPulse - Pricing Configuration
Defines pricing tiers, features, and billing logic
"""

# ============================================================================
# PRICING TIERS WITH 80% MARGIN
# ============================================================================
# Cost structure estimates:
# - Hosting/Infrastructure: ~$0.50/user/month
# - Email (Resend): $0.40/1000 emails after free tier
# - Storage: ~$0.023/GB/month
# - Support overhead: ~$0.30/user/month
#
# Formula: Price = Cost / 0.20 (for 80% margin)
# ============================================================================

PRICING_TIERS = {
    "free": {
        "id": "free",
        "name": "Free",
        "description": "Perfect for getting started",
        "monthly_price": 0,
        "annual_price": 0,
        "annual_monthly_equivalent": 0,
        "stripe_monthly_price_id": None,  # No payment needed
        "stripe_annual_price_id": None,
        "features": {
            "users": 2,
            "projects": 1,
            "forms": 3,
            "submissions_per_month": 100,
            "storage_gb": 0.5,
            "emails_per_month": 100,
            "data_retention_days": 30,
            "api_requests_per_day": 100,
        },
        "included_features": [
            "Basic form builder",
            "Real-time submissions",
            "Basic analytics dashboard",
            "Email notifications",
            "Mobile data collection",
            "Community support",
        ],
        "excluded_features": [
            "Custom branding",
            "API access",
            "Advanced analytics",
            "Team collaboration",
            "Priority support",
            "SSO/SAML",
            "Audit logs",
            "Custom domains",
        ],
        "badge": None,
        "popular": False,
    },
    "starter": {
        "id": "starter",
        "name": "Starter",
        "description": "For small teams getting started",
        "monthly_price": 29.00,
        "annual_price": 278.40,  # 29 * 12 * 0.80 = 20% discount
        "annual_monthly_equivalent": 23.20,
        "stripe_monthly_price_id": "price_starter_monthly",
        "stripe_annual_price_id": "price_starter_annual",
        "features": {
            "users": 5,
            "projects": 5,
            "forms": 20,
            "submissions_per_month": 2000,
            "storage_gb": 10,
            "emails_per_month": 5000,
            "data_retention_days": 90,
            "api_requests_per_day": 1000,
        },
        "included_features": [
            "Everything in Free",
            "5 team members",
            "20 forms",
            "2,000 submissions/month",
            "10 GB storage",
            "5,000 emails/month",
            "Basic API access",
            "Email support",
            "Data export (CSV, Excel)",
            "Custom form themes",
        ],
        "excluded_features": [
            "Advanced analytics",
            "Priority support",
            "SSO/SAML",
            "Audit logs",
            "Custom domains",
            "White-label",
        ],
        "badge": None,
        "popular": False,
    },
    "pro": {
        "id": "pro",
        "name": "Professional",
        "description": "For growing organizations",
        "monthly_price": 79.00,
        "annual_price": 758.40,  # 79 * 12 * 0.80
        "annual_monthly_equivalent": 63.20,
        "stripe_monthly_price_id": "price_pro_monthly",
        "stripe_annual_price_id": "price_pro_annual",
        "features": {
            "users": 25,
            "projects": 20,
            "forms": 100,
            "submissions_per_month": 20000,
            "storage_gb": 100,
            "emails_per_month": 25000,
            "data_retention_days": 365,
            "api_requests_per_day": 10000,
        },
        "included_features": [
            "Everything in Starter",
            "25 team members",
            "100 forms",
            "20,000 submissions/month",
            "100 GB storage",
            "25,000 emails/month",
            "Advanced analytics & dashboards",
            "Full API access",
            "Priority email support",
            "Team collaboration tools",
            "Role-based permissions",
            "Offline data collection",
            "GPS & location tracking",
            "Photo & media capture",
            "Conditional logic",
            "Data validation rules",
        ],
        "excluded_features": [
            "SSO/SAML",
            "Audit logs",
            "Custom domains",
            "White-label",
            "Dedicated support",
        ],
        "badge": "Most Popular",
        "popular": True,
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "description": "For large organizations with advanced needs",
        "monthly_price": 249.00,
        "annual_price": 2390.40,  # 249 * 12 * 0.80
        "annual_monthly_equivalent": 199.20,
        "stripe_monthly_price_id": "price_enterprise_monthly",
        "stripe_annual_price_id": "price_enterprise_annual",
        "features": {
            "users": -1,  # Unlimited
            "projects": -1,
            "forms": -1,
            "submissions_per_month": 100000,
            "storage_gb": 1000,
            "emails_per_month": 100000,
            "data_retention_days": -1,  # Unlimited
            "api_requests_per_day": -1,
        },
        "included_features": [
            "Everything in Professional",
            "Unlimited team members",
            "Unlimited forms & projects",
            "100,000 submissions/month",
            "1 TB storage",
            "100,000 emails/month",
            "SSO/SAML authentication",
            "Complete audit logs",
            "Custom domain support",
            "White-label branding",
            "Dedicated account manager",
            "24/7 priority support",
            "Custom integrations",
            "SLA guarantee (99.9%)",
            "On-premise deployment option",
            "Advanced security controls",
            "HIPAA/GDPR compliance",
        ],
        "excluded_features": [],
        "badge": "Best Value",
        "popular": False,
    },
}

# ============================================================================
# OVERAGE PRICING (when exceeding tier limits)
# ============================================================================

OVERAGE_PRICING = {
    "submissions": {
        "unit": "per 1,000 submissions",
        "price": 5.00,
    },
    "storage": {
        "unit": "per GB/month",
        "price": 0.50,
    },
    "emails": {
        "unit": "per 1,000 emails",
        "price": 2.00,
    },
    "api_requests": {
        "unit": "per 10,000 requests",
        "price": 1.00,
    },
}

# ============================================================================
# FEATURE FLAGS BY TIER
# ============================================================================

FEATURE_FLAGS = {
    "free": {
        "api_access": False,
        "advanced_analytics": False,
        "team_collaboration": False,
        "custom_branding": False,
        "sso_saml": False,
        "audit_logs": False,
        "custom_domains": False,
        "white_label": False,
        "priority_support": False,
        "offline_mode": True,
        "conditional_logic": False,
        "data_export": True,
        "webhooks": False,
    },
    "starter": {
        "api_access": True,
        "advanced_analytics": False,
        "team_collaboration": True,
        "custom_branding": True,
        "sso_saml": False,
        "audit_logs": False,
        "custom_domains": False,
        "white_label": False,
        "priority_support": False,
        "offline_mode": True,
        "conditional_logic": True,
        "data_export": True,
        "webhooks": True,
    },
    "pro": {
        "api_access": True,
        "advanced_analytics": True,
        "team_collaboration": True,
        "custom_branding": True,
        "sso_saml": False,
        "audit_logs": False,
        "custom_domains": False,
        "white_label": False,
        "priority_support": True,
        "offline_mode": True,
        "conditional_logic": True,
        "data_export": True,
        "webhooks": True,
    },
    "enterprise": {
        "api_access": True,
        "advanced_analytics": True,
        "team_collaboration": True,
        "custom_branding": True,
        "sso_saml": True,
        "audit_logs": True,
        "custom_domains": True,
        "white_label": True,
        "priority_support": True,
        "offline_mode": True,
        "conditional_logic": True,
        "data_export": True,
        "webhooks": True,
    },
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_tier_by_id(tier_id: str) -> dict:
    """Get tier configuration by ID"""
    return PRICING_TIERS.get(tier_id)


def get_tier_limits(tier_id: str) -> dict:
    """Get feature limits for a tier"""
    tier = PRICING_TIERS.get(tier_id)
    if tier:
        return tier.get("features", {})
    return {}


def get_tier_feature_flags(tier_id: str) -> dict:
    """Get feature flags for a tier"""
    return FEATURE_FLAGS.get(tier_id, FEATURE_FLAGS["free"])


def check_feature_allowed(tier_id: str, feature: str) -> bool:
    """Check if a feature is allowed for a tier"""
    flags = get_tier_feature_flags(tier_id)
    return flags.get(feature, False)


def calculate_overage(tier_id: str, usage: dict) -> dict:
    """Calculate overage charges based on usage"""
    limits = get_tier_limits(tier_id)
    overages = {}
    total_overage = 0.0
    
    # Check submissions overage
    if usage.get("submissions", 0) > limits.get("submissions_per_month", 0):
        excess = usage["submissions"] - limits["submissions_per_month"]
        overage_units = (excess + 999) // 1000  # Round up to nearest 1000
        cost = overage_units * OVERAGE_PRICING["submissions"]["price"]
        overages["submissions"] = {"excess": excess, "cost": cost}
        total_overage += cost
    
    # Check storage overage
    if usage.get("storage_gb", 0) > limits.get("storage_gb", 0):
        excess = usage["storage_gb"] - limits["storage_gb"]
        cost = excess * OVERAGE_PRICING["storage"]["price"]
        overages["storage"] = {"excess_gb": excess, "cost": cost}
        total_overage += cost
    
    # Check email overage
    if usage.get("emails", 0) > limits.get("emails_per_month", 0):
        excess = usage["emails"] - limits["emails_per_month"]
        overage_units = (excess + 999) // 1000
        cost = overage_units * OVERAGE_PRICING["emails"]["price"]
        overages["emails"] = {"excess": excess, "cost": cost}
        total_overage += cost
    
    # Check API requests overage
    daily_limit = limits.get("api_requests_per_day", 0)
    if daily_limit > 0 and usage.get("api_requests", 0) > daily_limit * 30:
        excess = usage["api_requests"] - (daily_limit * 30)
        overage_units = (excess + 9999) // 10000
        cost = overage_units * OVERAGE_PRICING["api_requests"]["price"]
        overages["api_requests"] = {"excess": excess, "cost": cost}
        total_overage += cost
    
    return {
        "overages": overages,
        "total_overage": round(total_overage, 2)
    }


def get_all_tiers() -> list:
    """Get all pricing tiers as a list"""
    return list(PRICING_TIERS.values())


def get_annual_discount_percent() -> int:
    """Get the annual discount percentage"""
    return 20
