"""DataPulse - Submission Workflow Automation API"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import json

from auth import get_current_user

router = APIRouter(prefix="/workflows", tags=["Workflows"])


# Workflow trigger types
TRIGGER_TYPES = [
    {"id": "submission_created", "name": "Submission Created", "description": "When a new submission is received"},
    {"id": "submission_updated", "name": "Submission Updated", "description": "When a submission is modified"},
    {"id": "quality_below", "name": "Quality Below Threshold", "description": "When quality score falls below threshold"},
    {"id": "quality_above", "name": "Quality Above Threshold", "description": "When quality score exceeds threshold"},
    {"id": "field_value", "name": "Field Value Match", "description": "When a field matches a specific value"},
    {"id": "schedule", "name": "Scheduled", "description": "Run on a schedule"},
    {"id": "manual", "name": "Manual Trigger", "description": "Triggered manually by user"}
]

# Action types
ACTION_TYPES = [
    {"id": "assign_reviewer", "name": "Assign Reviewer", "description": "Assign submission to a reviewer"},
    {"id": "auto_approve", "name": "Auto Approve", "description": "Automatically approve submission"},
    {"id": "auto_reject", "name": "Auto Reject", "description": "Automatically reject submission"},
    {"id": "flag_review", "name": "Flag for Review", "description": "Flag submission for manual review"},
    {"id": "send_notification", "name": "Send Notification", "description": "Send email/push notification"},
    {"id": "create_case", "name": "Create Case", "description": "Create a case from submission"},
    {"id": "update_field", "name": "Update Field", "description": "Update a submission field"},
    {"id": "webhook", "name": "Call Webhook", "description": "Send data to external URL"},
    {"id": "run_validation", "name": "Run Validation", "description": "Execute custom validation rules"}
]


class WorkflowCondition(BaseModel):
    field: str
    operator: str  # "equals", "not_equals", "contains", "greater_than", "less_than", "is_empty", "is_not_empty"
    value: Any


class WorkflowAction(BaseModel):
    action_type: str
    config: Dict[str, Any]
    

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    form_id: Optional[str] = None  # If null, applies to all forms
    trigger_type: str
    trigger_config: Dict[str, Any] = {}
    conditions: List[WorkflowCondition] = []
    condition_logic: str = "and"  # "and" or "or"
    actions: List[WorkflowAction]
    is_active: bool = True
    priority: int = 0


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    conditions: Optional[List[WorkflowCondition]] = None
    condition_logic: Optional[str] = None
    actions: Optional[List[WorkflowAction]] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


def evaluate_condition(submission_data: Dict, condition: Dict) -> bool:
    """Evaluate a single workflow condition"""
    field = condition.get("field")
    operator = condition.get("operator")
    expected = condition.get("value")
    
    actual = submission_data.get(field)
    
    if operator == "equals":
        return actual == expected
    elif operator == "not_equals":
        return actual != expected
    elif operator == "contains":
        return expected in str(actual) if actual else False
    elif operator == "greater_than":
        try:
            return float(actual) > float(expected)
        except (TypeError, ValueError):
            return False
    elif operator == "less_than":
        try:
            return float(actual) < float(expected)
        except (TypeError, ValueError):
            return False
    elif operator == "is_empty":
        return not actual
    elif operator == "is_not_empty":
        return bool(actual)
    elif operator == "in_list":
        return actual in expected if isinstance(expected, list) else False
    
    return False


def evaluate_conditions(submission_data: Dict, conditions: List[Dict], logic: str) -> bool:
    """Evaluate all workflow conditions"""
    if not conditions:
        return True
    
    results = [evaluate_condition(submission_data, c) for c in conditions]
    
    if logic == "and":
        return all(results)
    else:  # "or"
        return any(results)


@router.get("/triggers")
async def get_trigger_types():
    """Get available workflow trigger types"""
    return {"triggers": TRIGGER_TYPES}


@router.get("/actions")
async def get_action_types():
    """Get available workflow action types"""
    return {"actions": ACTION_TYPES}


@router.get("/operators")
async def get_condition_operators():
    """Get available condition operators"""
    return {
        "operators": [
            {"id": "equals", "name": "Equals", "symbol": "="},
            {"id": "not_equals", "name": "Does Not Equal", "symbol": "≠"},
            {"id": "contains", "name": "Contains", "symbol": "∋"},
            {"id": "greater_than", "name": "Greater Than", "symbol": ">"},
            {"id": "less_than", "name": "Less Than", "symbol": "<"},
            {"id": "is_empty", "name": "Is Empty", "symbol": "∅"},
            {"id": "is_not_empty", "name": "Is Not Empty", "symbol": "≠∅"},
            {"id": "in_list", "name": "In List", "symbol": "∈"}
        ]
    }


@router.get("/{org_id}/templates")
async def get_workflow_templates(org_id: str):
    """Get pre-built workflow templates"""
    
    templates = [
        {
            "id": "quality_gate",
            "name": "Quality Gate",
            "description": "Auto-approve high quality, flag low quality submissions",
            "category": "Quality",
            "workflow": {
                "trigger_type": "submission_created",
                "conditions": [],
                "actions": [
                    {
                        "action_type": "auto_approve",
                        "config": {},
                        "condition": {"field": "quality_score", "operator": "greater_than", "value": 90}
                    },
                    {
                        "action_type": "flag_review",
                        "config": {"reason": "Quality score below threshold"},
                        "condition": {"field": "quality_score", "operator": "less_than", "value": 70}
                    }
                ]
            }
        },
        {
            "id": "supervisor_review",
            "name": "Supervisor Review",
            "description": "Route submissions to supervisor based on form type",
            "category": "Routing",
            "workflow": {
                "trigger_type": "submission_created",
                "conditions": [],
                "actions": [
                    {
                        "action_type": "assign_reviewer",
                        "config": {"assignment_type": "supervisor"}
                    }
                ]
            }
        },
        {
            "id": "case_followup",
            "name": "Case Follow-up",
            "description": "Create case for submissions requiring follow-up",
            "category": "Cases",
            "workflow": {
                "trigger_type": "field_value",
                "trigger_config": {"field": "requires_followup", "value": True},
                "conditions": [],
                "actions": [
                    {
                        "action_type": "create_case",
                        "config": {
                            "category": "Follow-up Required",
                            "priority": "high"
                        }
                    }
                ]
            }
        },
        {
            "id": "notification_alert",
            "name": "Alert Notification",
            "description": "Send alerts for critical submissions",
            "category": "Notifications",
            "workflow": {
                "trigger_type": "field_value",
                "trigger_config": {"field": "is_urgent", "value": True},
                "conditions": [],
                "actions": [
                    {
                        "action_type": "send_notification",
                        "config": {
                            "notification_type": "email",
                            "subject": "Urgent Submission Alert"
                        }
                    }
                ]
            }
        }
    ]
    
    return {"templates": templates}


@router.get("/{org_id}")
async def get_workflows(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get workflows for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if form_id:
        query["$or"] = [{"form_id": form_id}, {"form_id": None}]
    
    workflows = await db.workflows.find(query, {"_id": 0}).to_list(100)
    
    # Add some default workflows if none exist
    if not workflows:
        workflows = [
            {
                "id": "default_quality",
                "name": "Flag Low Quality Submissions",
                "description": "Automatically flag submissions with quality score below 70%",
                "trigger_type": "quality_below",
                "trigger_config": {"threshold": 70},
                "conditions": [],
                "actions": [{"action_type": "flag_review", "config": {"reason": "Low quality score"}}],
                "is_active": False,
                "is_default": True
            },
            {
                "id": "default_auto_approve",
                "name": "Auto-Approve High Quality",
                "description": "Automatically approve submissions with quality score above 90%",
                "trigger_type": "quality_above",
                "trigger_config": {"threshold": 90},
                "conditions": [],
                "actions": [{"action_type": "auto_approve", "config": {}}],
                "is_active": False,
                "is_default": True
            }
        ]
    
    return {"workflows": workflows}


@router.get("/{org_id}/{workflow_id}")
async def get_workflow(
    request: Request,
    org_id: str,
    workflow_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific workflow"""
    db = request.app.state.db
    
    workflow = await db.workflows.find_one(
        {"id": workflow_id, "org_id": org_id},
        {"_id": 0}
    )
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return workflow


@router.post("/{org_id}")
async def create_workflow(
    request: Request,
    org_id: str,
    workflow: WorkflowCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new workflow"""
    db = request.app.state.db
    
    workflow_data = workflow.model_dump()
    workflow_data["id"] = str(ObjectId())
    workflow_data["org_id"] = org_id
    workflow_data["created_by"] = current_user["user_id"]
    workflow_data["created_at"] = datetime.now(timezone.utc).isoformat()
    workflow_data["stats"] = {
        "executions": 0,
        "successful": 0,
        "failed": 0
    }
    
    await db.workflows.insert_one(workflow_data)
    
    return {"id": workflow_data["id"], "message": "Workflow created successfully"}


@router.put("/{org_id}/{workflow_id}")
async def update_workflow(
    request: Request,
    org_id: str,
    workflow_id: str,
    workflow: WorkflowUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a workflow"""
    db = request.app.state.db
    
    update_data = {k: v for k, v in workflow.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.workflows.update_one(
        {"id": workflow_id, "org_id": org_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {"message": "Workflow updated successfully"}


@router.delete("/{org_id}/{workflow_id}")
async def delete_workflow(
    request: Request,
    org_id: str,
    workflow_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a workflow"""
    db = request.app.state.db
    
    result = await db.workflows.delete_one(
        {"id": workflow_id, "org_id": org_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {"message": "Workflow deleted successfully"}


@router.post("/{org_id}/{workflow_id}/toggle")
async def toggle_workflow(
    request: Request,
    org_id: str,
    workflow_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle workflow active state"""
    db = request.app.state.db
    
    workflow = await db.workflows.find_one(
        {"id": workflow_id, "org_id": org_id}
    )
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    new_state = not workflow.get("is_active", False)
    
    await db.workflows.update_one(
        {"id": workflow_id},
        {"$set": {
            "is_active": new_state,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"is_active": new_state, "message": f"Workflow {'activated' if new_state else 'deactivated'}"}


@router.post("/{org_id}/{workflow_id}/execute")
async def execute_workflow_manually(
    request: Request,
    org_id: str,
    workflow_id: str,
    submission_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually execute a workflow for a submission"""
    db = request.app.state.db
    
    workflow = await db.workflows.find_one(
        {"id": workflow_id, "org_id": org_id},
        {"_id": 0}
    )
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    submission = await db.submissions.find_one(
        {"id": submission_id},
        {"_id": 0}
    )
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Execute workflow
    result = await execute_workflow(db, workflow, submission, current_user["user_id"])
    
    return {
        "executed": True,
        "result": result,
        "message": "Workflow executed successfully"
    }


async def execute_workflow(db, workflow: Dict, submission: Dict, triggered_by: str) -> Dict:
    """Execute a workflow's actions"""
    
    # Check conditions
    conditions_met = evaluate_conditions(
        submission.get("data", {}),
        workflow.get("conditions", []),
        workflow.get("condition_logic", "and")
    )
    
    if not conditions_met:
        return {"skipped": True, "reason": "Conditions not met"}
    
    results = []
    
    for action in workflow.get("actions", []):
        action_type = action.get("action_type")
        config = action.get("config", {})
        
        try:
            if action_type == "auto_approve":
                await db.submissions.update_one(
                    {"id": submission["id"]},
                    {"$set": {
                        "status": "approved",
                        "approved_by": "workflow",
                        "approved_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results.append({"action": action_type, "success": True})
                
            elif action_type == "auto_reject":
                await db.submissions.update_one(
                    {"id": submission["id"]},
                    {"$set": {
                        "status": "rejected",
                        "rejected_by": "workflow",
                        "rejected_at": datetime.now(timezone.utc).isoformat(),
                        "rejection_reason": config.get("reason", "Automated rejection")
                    }}
                )
                results.append({"action": action_type, "success": True})
                
            elif action_type == "flag_review":
                await db.submissions.update_one(
                    {"id": submission["id"]},
                    {"$set": {
                        "flagged": True,
                        "flag_reason": config.get("reason", "Flagged by workflow"),
                        "flagged_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results.append({"action": action_type, "success": True})
                
            elif action_type == "assign_reviewer":
                await db.submissions.update_one(
                    {"id": submission["id"]},
                    {"$set": {
                        "assigned_to": config.get("reviewer_id"),
                        "assigned_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results.append({"action": action_type, "success": True})
                
            elif action_type == "create_case":
                case_data = {
                    "id": str(ObjectId()),
                    "org_id": submission.get("org_id"),
                    "submission_id": submission["id"],
                    "subject_id": submission.get("data", {}).get(config.get("subject_field", "id")),
                    "status": "open",
                    "priority": config.get("priority", "medium"),
                    "category": config.get("category", "Auto-generated"),
                    "description": config.get("description", f"Case created from submission {submission['id']}"),
                    "created_by": "workflow",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.cases.insert_one(case_data)
                results.append({"action": action_type, "success": True, "case_id": case_data["id"]})
                
            elif action_type == "send_notification":
                # Store notification for later sending
                notification = {
                    "id": str(ObjectId()),
                    "type": config.get("notification_type", "email"),
                    "recipients": config.get("recipients", []),
                    "subject": config.get("subject", "Workflow Notification"),
                    "message": config.get("message", ""),
                    "submission_id": submission["id"],
                    "workflow_id": workflow["id"],
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.notifications.insert_one(notification)
                results.append({"action": action_type, "success": True})
                
            elif action_type == "update_field":
                field_path = f"data.{config.get('field')}"
                await db.submissions.update_one(
                    {"id": submission["id"]},
                    {"$set": {field_path: config.get("value")}}
                )
                results.append({"action": action_type, "success": True})
                
            else:
                results.append({"action": action_type, "success": False, "error": "Unknown action type"})
                
        except Exception as e:
            results.append({"action": action_type, "success": False, "error": str(e)})
    
    # Update workflow stats
    await db.workflows.update_one(
        {"id": workflow["id"]},
        {"$inc": {
            "stats.executions": 1,
            "stats.successful": 1 if all(r.get("success") for r in results) else 0,
            "stats.failed": 0 if all(r.get("success") for r in results) else 1
        }}
    )
    
    # Log execution
    execution_log = {
        "id": str(ObjectId()),
        "workflow_id": workflow["id"],
        "submission_id": submission["id"],
        "triggered_by": triggered_by,
        "results": results,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.workflow_logs.insert_one(execution_log)
    
    return {"results": results}


@router.get("/{org_id}/{workflow_id}/logs")
async def get_workflow_logs(
    request: Request,
    org_id: str,
    workflow_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get execution logs for a workflow"""
    db = request.app.state.db
    
    logs = await db.workflow_logs.find(
        {"workflow_id": workflow_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"logs": logs}
