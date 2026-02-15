"""DataPulse - Main FastAPI Application"""
from fastapi import FastAPI, APIRouter, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with connection pooling
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    minPoolSize=5,
    maxPoolSize=50,
    maxIdleTimeMS=30000,
    serverSelectionTimeoutMS=5000
)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="DataPulse API",
    description="Modern data collection platform for research, M&E, and field surveys",
    version="1.0.0"
)

# Store db in app state for route access
app.state.db = db

# Setup rate limiting
from utils.rate_limiter import limiter, rate_limit_exceeded_handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Import routes
from routes.auth_routes import router as auth_router
from routes.org_routes import router as org_router
from routes.project_routes import router as project_router
from routes.form_routes import router as form_router
from routes.submission_routes import router as submission_router
from routes.case_routes import router as case_router
from routes.export_routes import router as export_router
from routes.dashboard_routes import router as dashboard_router
from routes.media_routes import router as media_router
from routes.gps_routes import router as gps_router
from routes.template_routes import router as template_router
from routes.logic_routes import router as logic_router
from routes.widget_routes import router as widget_router
from routes.case_import_routes import router as case_import_router
from routes.collaboration_routes import router as collaboration_router
from routes.duplicate_routes import router as duplicate_router
from routes.versioning_routes import router as versioning_router
from routes.analytics_routes import router as analytics_router
from routes.rbac_routes import router as rbac_router
from routes.workflow_routes import router as workflow_router
from routes.translation_routes import router as translation_router
from routes.security_routes import router as security_router
from routes.admin_routes import router as admin_router
from routes.paradata_routes import router as paradata_router
from routes.revision_routes import router as revision_router
from routes.dataset_routes import router as dataset_router
from routes.survey_routes import router as survey_router
from routes.cati_routes import router as cati_router
from routes.backcheck_routes import router as backcheck_router
from routes.preload_routes import router as preload_router
from routes.quality_ai_routes import router as quality_ai_router
from routes.cawi_routes import router as cawi_router
from routes.simulation_routes import router as simulation_router
from routes.device_routes import router as device_router
from routes.analysis_routes import router as analysis_router
from routes.stats_routes import router as stats_router
from routes.statistics import router as statistics_modular_router
from routes.ai_copilot_routes import router as ai_copilot_router
from routes.analysis_export_routes import router as analysis_export_router
from routes.report_routes import router as report_router
from routes.reproducibility_routes import router as reproducibility_router
from routes.survey_stats_routes import router as survey_stats_router
from routes.advanced_models_routes import router as advanced_models_router
from routes.dashboard_builder_routes import router as dashboard_builder_router
from routes.audit_routes import router as audit_router
from routes.job_routes import router as job_router

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(org_router)
api_router.include_router(project_router)
api_router.include_router(form_router)
api_router.include_router(submission_router)
api_router.include_router(case_router)
api_router.include_router(export_router)
api_router.include_router(dashboard_router)
api_router.include_router(media_router)
api_router.include_router(gps_router)
api_router.include_router(template_router)
api_router.include_router(logic_router)
api_router.include_router(widget_router)
api_router.include_router(case_import_router)
api_router.include_router(collaboration_router)
api_router.include_router(duplicate_router)
api_router.include_router(versioning_router)
api_router.include_router(analytics_router)
api_router.include_router(rbac_router)
api_router.include_router(workflow_router)
api_router.include_router(translation_router)
api_router.include_router(security_router)
api_router.include_router(admin_router)
api_router.include_router(paradata_router)
api_router.include_router(revision_router)
api_router.include_router(dataset_router)
api_router.include_router(survey_router)
api_router.include_router(cati_router)
api_router.include_router(backcheck_router)
api_router.include_router(preload_router)
api_router.include_router(quality_ai_router)
api_router.include_router(cawi_router)
api_router.include_router(simulation_router)
api_router.include_router(device_router)
api_router.include_router(analysis_router)
api_router.include_router(stats_router)
api_router.include_router(statistics_modular_router)  # New modular statistics routes
api_router.include_router(job_router)  # Background job management
api_router.include_router(ai_copilot_router)
api_router.include_router(analysis_export_router)
api_router.include_router(report_router)
api_router.include_router(reproducibility_router)
api_router.include_router(survey_stats_router)
api_router.include_router(advanced_models_router)
api_router.include_router(dashboard_builder_router)
api_router.include_router(audit_router)
api_router.include_router(rbac_router)


# Health check endpoint
@api_router.get("/")
async def root():
    return {"message": "DataPulse API is running", "version": "1.0.0"}


@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}


# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_db_client():
    """Initialize database indexes on startup"""
    logger.info("DataPulse API starting up...")
    
    # Create indexes for better query performance
    try:
        # Users
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        
        # Organizations
        await db.organizations.create_index("slug", unique=True)
        await db.organizations.create_index("id", unique=True)
        
        # Org Members
        await db.org_members.create_index([("org_id", 1), ("user_id", 1)], unique=True)
        
        # Projects
        await db.projects.create_index("id", unique=True)
        await db.projects.create_index([("org_id", 1), ("status", 1)])
        
        # Forms
        await db.forms.create_index("id", unique=True)
        await db.forms.create_index([("project_id", 1), ("status", 1)])
        
        # Submissions
        await db.submissions.create_index("id", unique=True)
        await db.submissions.create_index([("form_id", 1), ("submitted_at", -1)])
        await db.submissions.create_index([("org_id", 1), ("submitted_at", -1)])
        await db.submissions.create_index([("project_id", 1), ("status", 1)])
        
        # Cases
        await db.cases.create_index("id", unique=True)
        await db.cases.create_index([("project_id", 1), ("respondent_id", 1)], unique=True)
        
        # Audit Logs
        await db.audit_logs.create_index([("org_id", 1), ("timestamp", -1)])
        
        # API Keys
        await db.api_keys.create_index("key_hash", unique=True)
        await db.api_keys.create_index([("org_id", 1), ("is_active", 1)])
        
        # API Audit Logs
        await db.api_audit_logs.create_index([("org_id", 1), ("timestamp", -1)])
        await db.api_audit_logs.create_index([("timestamp", -1)])
        
        # Invoices
        await db.invoices.create_index("id", unique=True)
        await db.invoices.create_index([("org_id", 1), ("created_at", -1)])
        
        # Billing Events
        await db.billing_events.create_index([("org_id", 1), ("timestamp", -1)])
        
        # Paradata Sessions
        await db.paradata_sessions.create_index("id", unique=True)
        await db.paradata_sessions.create_index([("submission_id", 1)])
        await db.paradata_sessions.create_index([("enumerator_id", 1), ("session_start", -1)])
        await db.paradata_sessions.create_index([("form_id", 1), ("session_start", -1)])
        
        # Submission Revisions
        await db.submission_revisions.create_index("id", unique=True)
        await db.submission_revisions.create_index([("submission_id", 1), ("version", 1)])
        
        # Revision Audit Trail
        await db.revision_audit_trail.create_index([("submission_id", 1), ("timestamp", 1)])
        
        # Correction Requests
        await db.correction_requests.create_index("id", unique=True)
        await db.correction_requests.create_index([("enumerator_id", 1), ("status", 1)])
        
        # Lookup Datasets
        await db.lookup_datasets.create_index("id", unique=True)
        await db.lookup_datasets.create_index([("org_id", 1), ("is_active", 1)])
        
        # Dataset Write-back Log
        await db.dataset_write_back_log.create_index([("dataset_id", 1), ("timestamp", -1)])
        
        # Survey Distributions (Token/Panel Surveys)
        await db.survey_distributions.create_index("id", unique=True)
        await db.survey_distributions.create_index([("org_id", 1), ("status", 1)])
        await db.survey_invites.create_index("id", unique=True)
        await db.survey_invites.create_index("token_hash", unique=True)
        await db.survey_invites.create_index([("distribution_id", 1), ("status", 1)])
        await db.survey_panels.create_index("id", unique=True)
        await db.panel_members.create_index("id", unique=True)
        await db.panel_members.create_index([("panel_id", 1), ("status", 1)])
        
        # CATI (Computer-Assisted Telephone Interviewing)
        await db.cati_projects.create_index("id", unique=True)
        await db.cati_projects.create_index([("org_id", 1), ("status", 1)])
        await db.cati_queue.create_index("id", unique=True)
        await db.cati_queue.create_index([("project_id", 1), ("status", 1), ("priority", -1)])
        await db.cati_queue.create_index([("locked_by", 1), ("status", 1)])
        await db.cati_calls.create_index("id", unique=True)
        await db.cati_calls.create_index([("project_id", 1), ("start_time", -1)])
        await db.cati_calls.create_index([("interviewer_id", 1), ("start_time", -1)])
        
        # Back-check Module
        await db.backcheck_configs.create_index("id", unique=True)
        await db.backcheck_configs.create_index([("org_id", 1), ("project_id", 1)])
        await db.backchecks.create_index("id", unique=True)
        await db.backchecks.create_index([("config_id", 1), ("status", 1)])
        await db.backchecks.create_index([("assigned_to", 1), ("status", 1)])
        await db.backchecks.create_index([("original_enumerator_id", 1)])
        await db.enumerator_quality.create_index("enumerator_id", unique=True)
        
        # Preload/Write-back
        await db.preload_configs.create_index("id", unique=True)
        await db.preload_configs.create_index([("org_id", 1), ("form_id", 1)])
        await db.writeback_configs.create_index("id", unique=True)
        await db.writeback_configs.create_index([("org_id", 1), ("form_id", 1)])
        await db.preload_logs.create_index([("form_id", 1), ("timestamp", -1)])
        await db.writeback_logs.create_index([("form_id", 1), ("timestamp", -1)])
        await db.external_api_configs.create_index("id", unique=True)
        
        # Quality AI Monitoring
        await db.speeding_configs.create_index("id", unique=True)
        await db.speeding_configs.create_index([("org_id", 1), ("form_id", 1)])
        await db.audio_audit_configs.create_index("id", unique=True)
        await db.audio_audit_configs.create_index([("org_id", 1), ("form_id", 1)])
        await db.ai_monitoring_configs.create_index("id", unique=True)
        await db.ai_monitoring_configs.create_index("org_id")
        await db.quality_alerts.create_index("id", unique=True)
        await db.quality_alerts.create_index([("org_id", 1), ("status", 1)])
        await db.quality_alerts.create_index([("submission_id", 1), ("alert_type", 1)])
        await db.ai_analyses.create_index([("submission_id", 1)])
        
        # CAWI Sessions
        await db.cawi_sessions.create_index("id", unique=True)
        await db.cawi_sessions.create_index([("form_id", 1), ("token", 1)])
        await db.cawi_sessions.create_index([("form_id", 1), ("status", 1)])
        
        # AI Field Simulation
        await db.simulation_reports.create_index("id", unique=True)
        await db.simulation_reports.create_index([("org_id", 1), ("form_id", 1)])
        await db.simulation_reports.create_index([("created_at", -1)])
        
        # Device Management & Remote Wipe
        await db.devices.create_index("id", unique=True)
        await db.devices.create_index([("org_id", 1), ("user_id", 1)])
        await db.devices.create_index([("org_id", 1), ("status", 1)])
        await db.device_activity_logs.create_index([("device_id", 1), ("timestamp", -1)])
        await db.device_activity_logs.create_index([("org_id", 1), ("timestamp", -1)])
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Cleanup on shutdown"""
    logger.info("DataPulse API shutting down...")
    client.close()
