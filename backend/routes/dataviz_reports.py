"""
DataViz Studio - Scheduled Report Delivery Routes
Email delivery of reports on schedule using Resend
"""
from fastapi import APIRouter, HTTPException, status, Request, Depends, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import os
import asyncio
import logging
import resend
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/reports", tags=["Report Delivery"])
logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


class ScheduleConfig(BaseModel):
    frequency: str  # daily, weekly, monthly
    day_of_week: Optional[int] = None  # 0=Monday, 6=Sunday (for weekly)
    day_of_month: Optional[int] = None  # 1-28 (for monthly)
    time: str = "09:00"  # HH:MM format
    timezone: str = "UTC"


class ReportSchedule(BaseModel):
    dashboard_id: str
    name: str
    recipients: List[EmailStr]
    schedule: ScheduleConfig
    include_pdf: bool = True
    include_data: bool = False
    custom_message: Optional[str] = None


class SendReportRequest(BaseModel):
    dashboard_id: str
    recipients: List[EmailStr]
    subject: Optional[str] = None
    message: Optional[str] = None


async def send_email_async(to: List[str], subject: str, html: str) -> dict:
    """Send email using Resend API (non-blocking)"""
    params = {
        "from": SENDER_EMAIL,
        "to": to,
        "subject": subject,
        "html": html
    }
    
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"success": True, "email_id": result.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return {"success": False, "error": str(e)}


def generate_report_email_html(dashboard_name: str, message: str, dashboard_url: str) -> str:
    """Generate HTML email template for report delivery"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
                                    DataPulse Report
                                </h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px;">
                                <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 20px;">
                                    {dashboard_name}
                                </h2>
                                <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                                    {message or "Your scheduled report is ready. Click the button below to view the full dashboard."}
                                </p>
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 16px 0;">
                                            <a href="{dashboard_url}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                                View Dashboard
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #334155; border-radius: 8px; margin-top: 24px;">
                                    <tr>
                                        <td style="padding: 16px;">
                                            <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                                                Generated: {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="background-color: #0f172a; padding: 24px; text-align: center; border-top: 1px solid #334155;">
                                <p style="margin: 0; color: #64748b; font-size: 12px;">
                                    Powered by DataPulse<br>
                                    <a href="#" style="color: #6366f1; text-decoration: none;">Unsubscribe</a> | 
                                    <a href="#" style="color: #6366f1; text-decoration: none;">Manage preferences</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


@router.post("/send")
async def send_report_now(
    request: Request,
    data: SendReportRequest,
    background_tasks: BackgroundTasks
):
    """Send a report immediately to specified recipients"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one(
        {"id": data.dashboard_id},
        {"_id": 0, "name": 1, "id": 1}
    )
    
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    if not resend.api_key:
        raise HTTPException(
            status_code=503, 
            detail="Email service not configured. Please add RESEND_API_KEY to environment."
        )
    
    dashboard_name = dashboard.get("name", "Untitled Dashboard")
    base_url = str(request.base_url).rstrip('/')
    dashboard_url = f"{base_url}/dashboards/{data.dashboard_id}"
    
    subject = data.subject or f"Report: {dashboard_name}"
    html = generate_report_email_html(dashboard_name, data.message, dashboard_url)
    
    result = await send_email_async(data.recipients, subject, html)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {result.get('error')}")
    
    await db.report_deliveries.insert_one({
        "dashboard_id": data.dashboard_id,
        "recipients": data.recipients,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "email_id": result.get("email_id"),
        "status": "sent"
    })
    
    return {
        "status": "success",
        "message": f"Report sent to {len(data.recipients)} recipient(s)",
        "email_id": result.get("email_id")
    }


@router.post("/schedules")
async def create_report_schedule(request: Request, data: ReportSchedule):
    """Create a new scheduled report delivery"""
    db = request.app.state.db
    
    dashboard = await db.dashboards.find_one({"id": data.dashboard_id}, {"_id": 0, "id": 1})
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    import uuid
    schedule_id = str(uuid.uuid4())
    
    schedule_doc = {
        "id": schedule_id,
        "dashboard_id": data.dashboard_id,
        "name": data.name,
        "recipients": data.recipients,
        "frequency": data.schedule.frequency,
        "day_of_week": data.schedule.day_of_week,
        "day_of_month": data.schedule.day_of_month,
        "time": data.schedule.time,
        "timezone": data.schedule.timezone,
        "include_pdf": data.include_pdf,
        "include_data": data.include_data,
        "custom_message": data.custom_message,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_sent_at": None,
        "next_run_at": None
    }
    
    await db.report_schedules.insert_one(schedule_doc)
    
    return {
        "id": schedule_id,
        "status": "created",
        "message": f"Schedule created for {data.schedule.frequency} delivery"
    }


@router.get("/schedules")
async def list_report_schedules(request: Request, dashboard_id: Optional[str] = None):
    """List all report schedules"""
    db = request.app.state.db
    query = {}
    if dashboard_id:
        query["dashboard_id"] = dashboard_id
    schedules = await db.report_schedules.find(query, {"_id": 0}).to_list(100)
    return {"schedules": schedules}


@router.get("/schedules/{schedule_id}")
async def get_report_schedule(request: Request, schedule_id: str):
    """Get a specific schedule"""
    db = request.app.state.db
    schedule = await db.report_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.put("/schedules/{schedule_id}")
async def update_report_schedule(request: Request, schedule_id: str, data: ReportSchedule):
    """Update a report schedule"""
    db = request.app.state.db
    
    update_data = {
        "name": data.name,
        "recipients": data.recipients,
        "frequency": data.schedule.frequency,
        "day_of_week": data.schedule.day_of_week,
        "day_of_month": data.schedule.day_of_month,
        "time": data.schedule.time,
        "timezone": data.schedule.timezone,
        "include_pdf": data.include_pdf,
        "include_data": data.include_data,
        "custom_message": data.custom_message,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.report_schedules.update_one({"id": schedule_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "updated", "id": schedule_id}


@router.delete("/schedules/{schedule_id}")
async def delete_report_schedule(request: Request, schedule_id: str):
    """Delete a report schedule"""
    db = request.app.state.db
    result = await db.report_schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deleted", "id": schedule_id}


@router.post("/schedules/{schedule_id}/toggle")
async def toggle_report_schedule(request: Request, schedule_id: str):
    """Toggle a schedule on/off"""
    db = request.app.state.db
    schedule = await db.report_schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    new_status = not schedule.get("is_active", True)
    await db.report_schedules.update_one({"id": schedule_id}, {"$set": {"is_active": new_status}})
    return {"status": "success", "is_active": new_status}


@router.get("/deliveries")
async def list_report_deliveries(request: Request, dashboard_id: Optional[str] = None, limit: int = 50):
    """List recent report deliveries"""
    db = request.app.state.db
    query = {}
    if dashboard_id:
        query["dashboard_id"] = dashboard_id
    deliveries = await db.report_deliveries.find(query, {"_id": 0}).sort("sent_at", -1).to_list(limit)
    return {"deliveries": deliveries}
