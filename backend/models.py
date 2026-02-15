"""DataPulse - Pydantic Models for MongoDB Collections"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
import uuid


def utc_now():
    return datetime.now(timezone.utc)


def gen_id():
    return str(uuid.uuid4())


# ============= USER & AUTH MODELS =============
class UserBase(BaseModel):
    email: EmailStr
    name: str
    avatar: Optional[str] = None
    locale: str = "en"


class UserCreate(UserBase):
    password: Optional[str] = None  # None for SSO users


class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    hashed_password: Optional[str] = None
    sso_provider: Optional[str] = None
    sso_sub: Optional[str] = None
    is_superadmin: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    last_login: Optional[datetime] = None


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    avatar: Optional[str] = None
    locale: str
    is_superadmin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ============= ORGANIZATION MODELS =============
class OrganizationBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    logo: Optional[str] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class OrganizationCreate(OrganizationBase):
    pass


class Organization(OrganizationBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    is_active: bool = True


class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    logo: Optional[str]
    is_active: bool
    created_at: datetime


# ============= ORG MEMBER MODELS =============
RoleType = Literal["admin", "manager", "analyst", "enumerator", "viewer"]


class OrgMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    user_id: str
    role: RoleType = "viewer"
    joined_at: datetime = Field(default_factory=utc_now)
    invited_by: Optional[str] = None


class OrgMemberOut(BaseModel):
    id: str
    user: UserOut
    role: RoleType
    joined_at: datetime


# ============= PROJECT MODELS =============
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    settings: Dict[str, Any] = Field(default_factory=dict)


class ProjectCreate(ProjectBase):
    org_id: str


class Project(ProjectBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    status: Literal["draft", "active", "paused", "completed", "archived"] = "draft"


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    org_id: str
    status: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    created_at: datetime
    form_count: int = 0
    submission_count: int = 0


# ============= FORM FIELD MODELS =============
class FormFieldOption(BaseModel):
    value: str
    label: str
    label_sw: Optional[str] = None  # Swahili


class FormFieldValidation(BaseModel):
    required: bool = False
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    custom_error: Optional[str] = None


class FormFieldLogic(BaseModel):
    show_if: Optional[str] = None  # Field ID to check
    show_value: Optional[Any] = None  # Value to match
    operator: Optional[str] = "eq"  # eq, neq, gt, lt, contains


class FormField(BaseModel):
    id: str = Field(default_factory=gen_id)
    type: Literal[
        "text", "number", "date", "datetime", "time",
        "select", "multiselect", "radio", "checkbox",
        "textarea", "gps", "photo", "audio", "video",
        "barcode", "signature", "calculate", "note",
        "group", "repeat"
    ]
    name: str
    label: str
    label_sw: Optional[str] = None  # Swahili
    hint: Optional[str] = None
    hint_sw: Optional[str] = None
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    options: List[FormFieldOption] = Field(default_factory=list)
    validation: FormFieldValidation = Field(default_factory=FormFieldValidation)
    logic: Optional[FormFieldLogic] = None
    calculation: Optional[str] = None  # For calculated fields
    appearance: Optional[str] = None
    order: int = 0
    parent_id: Optional[str] = None  # For nested groups/repeats


# ============= FORM MODELS =============
class FormBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_language: str = "en"
    languages: List[str] = Field(default_factory=lambda: ["en", "sw"])


class FormCreate(FormBase):
    project_id: str
    fields: List[FormField] = Field(default_factory=list)


class Form(FormBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    project_id: str
    org_id: str
    version: int = 1
    fields: List[Dict[str, Any]] = Field(default_factory=list)
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    published_at: Optional[datetime] = None
    status: Literal["draft", "published", "archived"] = "draft"
    settings: Dict[str, Any] = Field(default_factory=dict)


class FormOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    project_id: str
    version: int
    status: str
    field_count: int = 0
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]


class FormDetailOut(FormOut):
    fields: List[Dict[str, Any]]
    default_language: str
    languages: List[str]
    settings: Dict[str, Any]


# ============= SUBMISSION MODELS =============
class SubmissionBase(BaseModel):
    form_id: str
    form_version: int
    data: Dict[str, Any]
    device_id: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None


class SubmissionCreate(SubmissionBase):
    pass


class Submission(SubmissionBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    project_id: str
    submitted_by: str
    submitted_at: datetime = Field(default_factory=utc_now)
    synced_at: Optional[datetime] = None
    gps_location: Optional[Dict[str, float]] = None
    gps_accuracy: Optional[float] = None
    status: Literal["pending", "approved", "rejected", "flagged"] = "pending"
    quality_score: Optional[float] = None
    quality_flags: List[str] = Field(default_factory=list)
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    case_id: Optional[str] = None


class SubmissionOut(BaseModel):
    id: str
    form_id: str
    form_version: int
    data: Dict[str, Any]
    submitted_by: str
    submitted_at: datetime
    status: str
    quality_score: Optional[float]
    quality_flags: List[str]
    gps_location: Optional[Dict[str, float]]


# ============= CASE MODELS =============
class CaseBase(BaseModel):
    respondent_id: str
    name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CaseCreate(CaseBase):
    project_id: str


class Case(CaseBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    project_id: str
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    status: Literal["open", "in_progress", "completed", "closed"] = "open"
    assigned_to: Optional[str] = None
    visit_count: int = 0
    last_visit: Optional[datetime] = None


class CaseOut(BaseModel):
    id: str
    respondent_id: str
    name: Optional[str]
    project_id: str
    status: str
    visit_count: int
    last_visit: Optional[datetime]
    created_at: datetime


# ============= AUDIT LOG MODELS =============
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    user_id: str
    action: str  # create, update, delete, login, export, etc.
    resource_type: str  # user, form, submission, etc.
    resource_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=utc_now)


class AuditLogOut(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Dict[str, Any]
    timestamp: datetime
    user_name: Optional[str] = None


# ============= EXPORT MODELS =============
class ExportRequest(BaseModel):
    form_id: str
    format: Literal["csv", "xlsx", "json"] = "csv"
    filters: Dict[str, Any] = Field(default_factory=dict)
    fields: Optional[List[str]] = None  # Specific fields to export


class ExportJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    user_id: str
    form_id: str
    format: str
    status: Literal["pending", "processing", "completed", "failed"] = "pending"
    file_url: Optional[str] = None
    row_count: int = 0
    created_at: datetime = Field(default_factory=utc_now)
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


# ============= DASHBOARD MODELS =============
class DashboardStats(BaseModel):
    total_projects: int = 0
    total_forms: int = 0
    total_submissions: int = 0
    total_cases: int = 0
    submissions_today: int = 0
    pending_reviews: int = 0
    active_enumerators: int = 0


class SubmissionTrend(BaseModel):
    date: str
    count: int


class QualityMetrics(BaseModel):
    avg_quality_score: float = 0
    flagged_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0


# ============= ASSIGNMENT MODELS =============
class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=gen_id)
    org_id: str
    project_id: str
    form_id: str
    user_id: str
    case_ids: List[str] = Field(default_factory=list)
    quota: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Literal["active", "paused", "completed"] = "active"
    created_at: datetime = Field(default_factory=utc_now)
    created_by: str


class AssignmentOut(BaseModel):
    id: str
    form_id: str
    form_name: str
    user_id: str
    user_name: str
    case_count: int
    quota: Optional[int]
    status: str
    created_at: datetime
