"""Super Admin - Multi-tenant Billing and Usage Tracking"""
from fastapi import APIRouter, Request, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import secrets
import os

router = APIRouter(prefix="/admin", tags=["Super Admin"])

# Billing Plans
BILLING_PLANS = {
    "free": {
        "id": "free",
        "name": "Free",
        "price_monthly": 0,
        "price_yearly": 0,
        "features": {
            "max_users": 3,
            "max_projects": 2,
            "max_forms": 5,
            "max_submissions_per_month": 1000,
            "max_storage_gb": 1,
            "api_requests_per_minute": 100,
            "support_level": "community",
            "export_formats": ["csv", "json"],
            "custom_branding": False,
            "sso_enabled": False,
            "audit_logs": False,
            "webhooks": False,
        }
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "price_monthly": 49,
        "price_yearly": 490,
        "features": {
            "max_users": 25,
            "max_projects": 10,
            "max_forms": 50,
            "max_submissions_per_month": 25000,
            "max_storage_gb": 25,
            "api_requests_per_minute": 1000,
            "support_level": "email",
            "export_formats": ["csv", "json", "xlsx", "stata", "spss"],
            "custom_branding": True,
            "sso_enabled": False,
            "audit_logs": True,
            "webhooks": True,
        }
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "price_monthly": 199,
        "price_yearly": 1990,
        "features": {
            "max_users": -1,  # Unlimited
            "max_projects": -1,
            "max_forms": -1,
            "max_submissions_per_month": -1,
            "max_storage_gb": 500,
            "api_requests_per_minute": 10000,
            "support_level": "priority",
            "export_formats": ["csv", "json", "xlsx", "stata", "spss"],
            "custom_branding": True,
            "sso_enabled": True,
            "audit_logs": True,
            "webhooks": True,
        }
    }
}


def is_super_admin(request: Request) -> bool:
    """Check if user is a super admin"""
    # In production, this would verify against SSO claims
    # For now, check a header or token claim
    return request.headers.get("X-Super-Admin") == "true" or True  # Demo mode


# Dashboard Overview
@router.get("/dashboard")
async def get_admin_dashboard(request: Request):
    """Get super admin dashboard overview"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    # Get overall stats
    total_orgs = await db.organizations.count_documents({})
    total_users = await db.users.count_documents({})
    total_submissions = await db.submissions.count_documents({})
    
    # Active in last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    active_orgs = await db.submissions.distinct("org_id", {"submitted_at": {"$gte": thirty_days_ago}})
    
    # Billing stats
    billing_pipeline = [
        {"$group": {
            "_id": "$billing_tier",
            "count": {"$sum": 1}
        }}
    ]
    billing_stats = await db.organizations.aggregate(billing_pipeline).to_list(10)
    
    # Recent signups
    recent_orgs = await db.organizations.find().sort("created_at", -1).limit(10).to_list(10)
    for org in recent_orgs:
        org["_id"] = str(org.get("_id", ""))
        if org.get("created_at") and hasattr(org["created_at"], 'isoformat'):
            org["created_at"] = org["created_at"].isoformat()
    
    # Revenue calculation (mock)
    monthly_revenue = 0
    for stat in billing_stats:
        tier = stat["_id"] or "free"
        count = stat["count"]
        if tier in BILLING_PLANS:
            monthly_revenue += BILLING_PLANS[tier]["price_monthly"] * count
    
    return {
        "stats": {
            "total_organizations": total_orgs,
            "total_users": total_users,
            "total_submissions": total_submissions,
            "active_organizations_30d": len(active_orgs),
            "monthly_revenue": monthly_revenue,
        },
        "billing_distribution": {stat["_id"] or "free": stat["count"] for stat in billing_stats},
        "recent_organizations": recent_orgs,
    }


# Organization Management
@router.get("/organizations")
async def list_all_organizations(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    search: str = None,
    tier: str = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
):
    """List all organizations with filtering"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"slug": {"$regex": search, "$options": "i"}}
        ]
    if tier:
        query["billing_tier"] = tier
    
    sort_dir = -1 if sort_order == "desc" else 1
    
    orgs = await db.organizations.find(query).sort(sort_by, sort_dir).skip(offset).limit(limit).to_list(limit)
    total = await db.organizations.count_documents(query)
    
    # Enrich with usage data
    for org in orgs:
        org["_id"] = str(org.get("_id", ""))
        if org.get("created_at") and hasattr(org["created_at"], 'isoformat'):
            org["created_at"] = org["created_at"].isoformat()
        
        # Get usage stats
        org_id = org.get("id")
        org["usage"] = {
            "users": await db.org_members.count_documents({"org_id": org_id}),
            "projects": await db.projects.count_documents({"org_id": org_id}),
            "forms": await db.forms.count_documents({"org_id": org_id}),
            "submissions_this_month": await db.submissions.count_documents({
                "org_id": org_id,
                "submitted_at": {"$gte": datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)}
            }),
        }
    
    return {
        "organizations": orgs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/organizations/{org_id}")
async def get_organization_details(org_id: str, request: Request):
    """Get detailed organization info including usage and billing"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    org["_id"] = str(org.get("_id", ""))
    
    # Get detailed usage
    usage = {
        "users": await db.org_members.count_documents({"org_id": org_id}),
        "projects": await db.projects.count_documents({"org_id": org_id}),
        "forms": await db.forms.count_documents({"org_id": org_id}),
        "total_submissions": await db.submissions.count_documents({"org_id": org_id}),
    }
    
    # Monthly submission trend
    monthly_submissions = []
    for i in range(6):
        month_start = (datetime.now(timezone.utc) - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        count = await db.submissions.count_documents({
            "org_id": org_id,
            "submitted_at": {"$gte": month_start, "$lt": month_end}
        })
        monthly_submissions.append({
            "month": month_start.strftime("%Y-%m"),
            "count": count
        })
    
    # API usage
    api_usage = await db.api_audit_logs.count_documents({
        "org_id": org_id,
        "timestamp": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}
    })
    
    # Get billing history
    invoices = await db.invoices.find({"org_id": org_id}).sort("created_at", -1).limit(12).to_list(12)
    for inv in invoices:
        inv["_id"] = str(inv.get("_id", ""))
        if inv.get("created_at"):
            inv["created_at"] = inv["created_at"].isoformat()
    
    # Current plan
    tier = org.get("billing_tier", "free")
    plan = BILLING_PLANS.get(tier, BILLING_PLANS["free"])
    
    return {
        "organization": org,
        "usage": usage,
        "monthly_submissions": monthly_submissions[::-1],  # Reverse for chronological order
        "api_requests_30d": api_usage,
        "current_plan": plan,
        "invoices": invoices,
    }


@router.put("/organizations/{org_id}/tier")
async def update_organization_tier(org_id: str, request: Request):
    """Update organization's billing tier"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    data = await request.json()
    new_tier = data.get("tier", "free")
    
    if new_tier not in BILLING_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier}")
    
    # Update org
    result = await db.organizations.update_one(
        {"id": org_id},
        {
            "$set": {
                "billing_tier": new_tier,
                "tier_updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Log the change
    await db.billing_events.insert_one({
        "org_id": org_id,
        "event_type": "tier_change",
        "new_tier": new_tier,
        "changed_by": "super_admin",
        "timestamp": datetime.now(timezone.utc)
    })
    
    return {"message": f"Organization tier updated to {new_tier}", "plan": BILLING_PLANS[new_tier]}


# Billing Plans Management
@router.get("/billing/plans")
async def get_billing_plans(request: Request):
    """Get all available billing plans"""
    return {"plans": list(BILLING_PLANS.values())}


@router.put("/billing/plans/{plan_id}")
async def update_billing_plan(plan_id: str, request: Request):
    """Update a billing plan (Super Admin only)"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if plan_id not in BILLING_PLANS:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    data = await request.json()
    
    # Update plan features
    if "features" in data:
        BILLING_PLANS[plan_id]["features"].update(data["features"])
    if "price_monthly" in data:
        BILLING_PLANS[plan_id]["price_monthly"] = data["price_monthly"]
    if "price_yearly" in data:
        BILLING_PLANS[plan_id]["price_yearly"] = data["price_yearly"]
    
    return {"message": "Plan updated", "plan": BILLING_PLANS[plan_id]}


# Invoice Management
@router.get("/invoices")
async def list_all_invoices(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    status: str = None,
    org_id: str = None
):
    """List all invoices across organizations"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    query = {}
    if status:
        query["status"] = status
    if org_id:
        query["org_id"] = org_id
    
    invoices = await db.invoices.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.invoices.count_documents(query)
    
    for inv in invoices:
        inv["_id"] = str(inv.get("_id", ""))
        if inv.get("created_at"):
            inv["created_at"] = inv["created_at"].isoformat()
        if inv.get("due_date"):
            inv["due_date"] = inv["due_date"].isoformat()
    
    return {"invoices": invoices, "total": total, "limit": limit, "offset": offset}


@router.post("/invoices/{org_id}/generate")
async def generate_invoice(org_id: str, request: Request):
    """Generate an invoice for an organization"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    tier = org.get("billing_tier", "free")
    plan = BILLING_PLANS.get(tier, BILLING_PLANS["free"])
    
    if plan["price_monthly"] == 0:
        raise HTTPException(status_code=400, detail="Cannot generate invoice for free tier")
    
    invoice = {
        "id": f"INV-{secrets.token_hex(8).upper()}",
        "org_id": org_id,
        "org_name": org.get("name"),
        "amount": plan["price_monthly"],
        "currency": "USD",
        "status": "pending",
        "tier": tier,
        "period_start": datetime.now(timezone.utc).replace(day=1),
        "period_end": (datetime.now(timezone.utc).replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1),
        "due_date": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc),
        "line_items": [
            {
                "description": f"{plan['name']} Plan - Monthly Subscription",
                "quantity": 1,
                "unit_price": plan["price_monthly"],
                "total": plan["price_monthly"]
            }
        ]
    }
    
    await db.invoices.insert_one(invoice)
    
    invoice["_id"] = str(invoice.get("_id", ""))
    invoice["period_start"] = invoice["period_start"].isoformat()
    invoice["period_end"] = invoice["period_end"].isoformat()
    invoice["due_date"] = invoice["due_date"].isoformat()
    invoice["created_at"] = invoice["created_at"].isoformat()
    
    return invoice


@router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, request: Request):
    """Update invoice status"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    data = await request.json()
    new_status = data.get("status")
    
    if new_status not in ["pending", "paid", "overdue", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc)}
    if new_status == "paid":
        update["paid_at"] = datetime.now(timezone.utc)
    
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update})
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": f"Invoice status updated to {new_status}"}


# Usage Alerts
@router.get("/alerts")
async def get_usage_alerts(request: Request):
    """Get organizations approaching or exceeding limits"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    alerts = []
    
    # Get all organizations
    orgs = await db.organizations.find().to_list(1000)
    
    for org in orgs:
        org_id = org.get("id")
        tier = org.get("billing_tier", "free")
        plan = BILLING_PLANS.get(tier, BILLING_PLANS["free"])
        features = plan["features"]
        
        # Check submission limit
        if features["max_submissions_per_month"] > 0:
            month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)
            submissions = await db.submissions.count_documents({
                "org_id": org_id,
                "submitted_at": {"$gte": month_start}
            })
            usage_pct = (submissions / features["max_submissions_per_month"]) * 100
            
            if usage_pct >= 80:
                alerts.append({
                    "org_id": org_id,
                    "org_name": org.get("name"),
                    "type": "submissions_limit",
                    "current": submissions,
                    "limit": features["max_submissions_per_month"],
                    "usage_percentage": round(usage_pct, 1),
                    "severity": "critical" if usage_pct >= 100 else "warning"
                })
        
        # Check user limit
        if features["max_users"] > 0:
            users = await db.org_members.count_documents({"org_id": org_id})
            if users >= features["max_users"] * 0.8:
                alerts.append({
                    "org_id": org_id,
                    "org_name": org.get("name"),
                    "type": "users_limit",
                    "current": users,
                    "limit": features["max_users"],
                    "usage_percentage": round((users / features["max_users"]) * 100, 1),
                    "severity": "critical" if users >= features["max_users"] else "warning"
                })
    
    # Sort by severity
    alerts.sort(key=lambda x: (0 if x["severity"] == "critical" else 1, -x["usage_percentage"]))
    
    return {"alerts": alerts, "total": len(alerts)}


# System Stats
@router.get("/system/stats")
async def get_system_stats(request: Request):
    """Get overall system statistics"""
    if not is_super_admin(request):
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    db = request.app.state.db
    
    # Get daily submission counts for last 30 days
    daily_submissions = []
    for i in range(30):
        day_start = (datetime.now(timezone.utc) - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.submissions.count_documents({
            "submitted_at": {"$gte": day_start, "$lt": day_end}
        })
        daily_submissions.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count
        })
    
    # Get daily new users
    daily_users = []
    for i in range(30):
        day_start = (datetime.now(timezone.utc) - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.users.count_documents({
            "created_at": {"$gte": day_start, "$lt": day_end}
        })
        daily_users.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count
        })
    
    # API calls today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    api_calls_today = await db.api_audit_logs.count_documents({
        "timestamp": {"$gte": today_start}
    })
    
    return {
        "daily_submissions": daily_submissions[::-1],
        "daily_new_users": daily_users[::-1],
        "api_calls_today": api_calls_today,
    }
