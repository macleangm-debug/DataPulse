"""DataPulse - Pricing & Billing Routes
Handles subscription management, Stripe checkout, and webhook processing
"""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, List
from datetime import datetime, timezone
import os
import uuid
import asyncio
import logging

from dotenv import load_dotenv
load_dotenv()

from config.pricing import (
    PRICING_TIERS, 
    get_tier_by_id, 
    get_all_tiers, 
    get_tier_limits,
    get_tier_feature_flags,
    calculate_overage,
    OVERAGE_PRICING
)

# Stripe integration
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

router = APIRouter(prefix="/pricing", tags=["Pricing & Billing"])
logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CreateCheckoutRequest(BaseModel):
    tier_id: str
    billing_period: str  # "monthly" or "annual"
    origin_url: str  # Frontend origin for success/cancel URLs
    user_email: Optional[str] = None
    org_id: Optional[str] = None


class CheckoutStatusRequest(BaseModel):
    session_id: str


class SubscriptionOut(BaseModel):
    id: str
    user_id: str
    org_id: Optional[str]
    tier_id: str
    tier_name: str
    status: str
    billing_period: str
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    stripe_subscription_id: Optional[str]
    created_at: datetime


class UsageOut(BaseModel):
    tier_id: str
    usage: Dict
    limits: Dict
    overage: Dict


# ============================================================================
# PRICING ENDPOINTS
# ============================================================================

@router.get("/plans")
async def get_pricing_plans():
    """Get all available pricing plans with features"""
    tiers = get_all_tiers()
    return {
        "plans": tiers,
        "annual_discount_percent": 20,
        "overage_pricing": OVERAGE_PRICING
    }


@router.get("/plans/{tier_id}")
async def get_plan_details(tier_id: str):
    """Get details for a specific pricing plan"""
    tier = get_tier_by_id(tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {
        "plan": tier,
        "feature_flags": get_tier_feature_flags(tier_id),
        "limits": get_tier_limits(tier_id)
    }


# ============================================================================
# CHECKOUT ENDPOINTS
# ============================================================================

@router.post("/checkout/create")
async def create_checkout_session(request: Request, data: CreateCheckoutRequest):
    """Create a Stripe checkout session for subscription"""
    db = request.app.state.db
    
    # Validate tier
    tier = get_tier_by_id(data.tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid pricing tier")
    
    # Free tier doesn't need checkout
    if data.tier_id == "free":
        raise HTTPException(
            status_code=400, 
            detail="Free tier doesn't require payment. Use the subscribe endpoint instead."
        )
    
    # Validate billing period
    if data.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    # Get price based on billing period
    if data.billing_period == "monthly":
        amount = float(tier["monthly_price"])
    else:
        amount = float(tier["annual_price"])
    
    # Initialize Stripe checkout
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}api/webhooks/stripe"
    
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    # Build success and cancel URLs
    success_url = f"{data.origin_url}/pricing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/pricing"
    
    # Create unique transaction ID
    transaction_id = str(uuid.uuid4())
    
    # Metadata for tracking
    metadata = {
        "transaction_id": transaction_id,
        "tier_id": data.tier_id,
        "tier_name": tier["name"],
        "billing_period": data.billing_period,
        "user_email": data.user_email or "",
        "org_id": data.org_id or ""
    }
    
    try:
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store transaction in database
        transaction_doc = {
            "id": transaction_id,
            "session_id": session.session_id,
            "user_email": data.user_email,
            "org_id": data.org_id,
            "tier_id": data.tier_id,
            "tier_name": tier["name"],
            "billing_period": data.billing_period,
            "amount": amount,
            "currency": "usd",
            "status": "pending",
            "payment_status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payment_transactions.insert_one(transaction_doc)
        
        logger.info(f"Checkout session created: {session.session_id} for tier {data.tier_id}")
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id,
            "transaction_id": transaction_id
        }
        
    except Exception as e:
        logger.error(f"Failed to create checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.get("/checkout/status/{session_id}")
async def get_checkout_status(request: Request, session_id: str):
    """Get the status of a checkout session and update subscription if paid"""
    db = request.app.state.db
    
    # Find transaction by session_id
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return current status
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "tier_id": transaction.get("tier_id"),
            "tier_name": transaction.get("tier_name"),
            "message": "Subscription already activated"
        }
    
    # Check status with Stripe
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}api/webhooks/stripe"
    
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status
        update_data = {
            "status": status.status,
            "payment_status": status.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # If paid, create/update subscription
        if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
            # Create subscription record
            subscription_id = str(uuid.uuid4())
            subscription_doc = {
                "id": subscription_id,
                "user_email": transaction.get("user_email"),
                "org_id": transaction.get("org_id"),
                "tier_id": transaction.get("tier_id"),
                "tier_name": transaction.get("tier_name"),
                "billing_period": transaction.get("billing_period"),
                "status": "active",
                "payment_transaction_id": transaction.get("id"),
                "stripe_session_id": session_id,
                "amount_paid": transaction.get("amount"),
                "currency": transaction.get("currency"),
                "current_period_start": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Calculate period end based on billing period
            from datetime import timedelta
            if transaction.get("billing_period") == "monthly":
                period_end = datetime.now(timezone.utc) + timedelta(days=30)
            else:
                period_end = datetime.now(timezone.utc) + timedelta(days=365)
            
            subscription_doc["current_period_end"] = period_end.isoformat()
            
            # Insert subscription
            await db.subscriptions.insert_one(subscription_doc)
            
            # Update user/org with tier
            if transaction.get("org_id"):
                await db.organizations.update_one(
                    {"id": transaction["org_id"]},
                    {"$set": {
                        "subscription_tier": transaction.get("tier_id"),
                        "subscription_id": subscription_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            update_data["subscription_id"] = subscription_id
            logger.info(f"Subscription created: {subscription_id} for tier {transaction.get('tier_id')}")
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "tier_id": transaction.get("tier_id"),
            "tier_name": transaction.get("tier_name"),
            "message": "Payment successful! Your subscription is now active." if status.payment_status == "paid" else "Payment pending"
        }
        
    except Exception as e:
        logger.error(f"Failed to check checkout status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")


# ============================================================================
# SUBSCRIPTION ENDPOINTS
# ============================================================================

@router.post("/subscribe/free")
async def subscribe_free_tier(request: Request, user_email: str, org_id: Optional[str] = None):
    """Subscribe to the free tier (no payment required)"""
    db = request.app.state.db
    
    # Check if already subscribed
    existing = await db.subscriptions.find_one(
        {"user_email": user_email, "status": "active"},
        {"_id": 0}
    )
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Already subscribed to {existing.get('tier_name')} plan"
        )
    
    # Create free subscription
    subscription_id = str(uuid.uuid4())
    subscription_doc = {
        "id": subscription_id,
        "user_email": user_email,
        "org_id": org_id,
        "tier_id": "free",
        "tier_name": "Free",
        "billing_period": "none",
        "status": "active",
        "amount_paid": 0,
        "currency": "usd",
        "current_period_start": datetime.now(timezone.utc).isoformat(),
        "current_period_end": None,  # Free tier doesn't expire
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscriptions.insert_one(subscription_doc)
    
    # Update org tier if org_id provided
    if org_id:
        await db.organizations.update_one(
            {"id": org_id},
            {"$set": {
                "subscription_tier": "free",
                "subscription_id": subscription_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "message": "Successfully subscribed to Free plan",
        "subscription_id": subscription_id,
        "tier_id": "free",
        "tier_name": "Free"
    }


@router.get("/subscription")
async def get_current_subscription(request: Request, user_email: str):
    """Get the current subscription for a user"""
    db = request.app.state.db
    
    subscription = await db.subscriptions.find_one(
        {"user_email": user_email, "status": "active"},
        {"_id": 0}
    )
    
    if not subscription:
        return {
            "has_subscription": False,
            "message": "No active subscription found"
        }
    
    # Get tier details
    tier = get_tier_by_id(subscription.get("tier_id"))
    
    return {
        "has_subscription": True,
        "subscription": subscription,
        "tier_details": tier,
        "feature_flags": get_tier_feature_flags(subscription.get("tier_id")),
        "limits": get_tier_limits(subscription.get("tier_id"))
    }


@router.get("/subscription/{subscription_id}")
async def get_subscription_by_id(request: Request, subscription_id: str):
    """Get subscription details by ID"""
    db = request.app.state.db
    
    subscription = await db.subscriptions.find_one(
        {"id": subscription_id},
        {"_id": 0}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    tier = get_tier_by_id(subscription.get("tier_id"))
    
    return {
        "subscription": subscription,
        "tier_details": tier,
        "feature_flags": get_tier_feature_flags(subscription.get("tier_id")),
        "limits": get_tier_limits(subscription.get("tier_id"))
    }


@router.post("/subscription/cancel")
async def cancel_subscription(request: Request, subscription_id: str):
    """Cancel a subscription"""
    db = request.app.state.db
    
    # Find subscription
    subscription = await db.subscriptions.find_one(
        {"id": subscription_id},
        {"_id": 0}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if subscription.get("status") != "active":
        raise HTTPException(status_code=400, detail="Subscription is not active")
    
    # Update subscription status
    await db.subscriptions.update_one(
        {"id": subscription_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Downgrade org to free tier
    if subscription.get("org_id"):
        await db.organizations.update_one(
            {"id": subscription["org_id"]},
            {"$set": {
                "subscription_tier": "free",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {
        "message": "Subscription cancelled successfully",
        "subscription_id": subscription_id
    }


# ============================================================================
# USAGE & BILLING ENDPOINTS
# ============================================================================

@router.get("/usage")
async def get_usage(request: Request, org_id: str):
    """Get current usage for an organization"""
    db = request.app.state.db
    
    # Get organization
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    tier_id = org.get("subscription_tier", "free")
    limits = get_tier_limits(tier_id)
    
    # Calculate current usage
    from datetime import timedelta
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count submissions this month
    submissions_count = await db.submissions.count_documents({
        "org_id": org_id,
        "submitted_at": {"$gte": month_start.isoformat()}
    })
    
    # Count team members
    members_count = await db.org_members.count_documents({"org_id": org_id})
    
    # Count projects and forms
    projects_count = await db.projects.count_documents({"org_id": org_id})
    forms_count = await db.forms.count_documents({"org_id": org_id})
    
    # Estimate storage (simplified - count media files)
    # In production, this would track actual file sizes
    storage_estimate_gb = 0.1 * submissions_count / 100  # Rough estimate
    
    usage = {
        "submissions_this_month": submissions_count,
        "users": members_count,
        "projects": projects_count,
        "forms": forms_count,
        "storage_gb": round(storage_estimate_gb, 2),
        "emails_this_month": 0,  # Would track actual email sends
        "api_requests_today": 0  # Would track actual API calls
    }
    
    # Calculate overage
    overage_info = calculate_overage(tier_id, {
        "submissions": submissions_count,
        "storage_gb": storage_estimate_gb,
        "emails": 0,
        "api_requests": 0
    })
    
    return {
        "tier_id": tier_id,
        "usage": usage,
        "limits": limits,
        "overage": overage_info,
        "period_start": month_start.isoformat()
    }


@router.get("/billing/history")
async def get_billing_history(request: Request, user_email: str):
    """Get billing/payment history for a user"""
    db = request.app.state.db
    
    transactions = await db.payment_transactions.find(
        {"user_email": user_email},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "transactions": transactions,
        "count": len(transactions)
    }
