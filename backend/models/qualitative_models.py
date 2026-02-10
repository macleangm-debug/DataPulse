"""
Qualitative Analysis Module - Data Models
Core objects for qualitative research analysis
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================

class SourceType(str, Enum):
    TRANSCRIPT = "transcript"
    FIELD_NOTES = "field_notes"
    OBSERVATION = "observation"
    OPEN_ENDED = "open_ended"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class GroupType(str, Enum):
    FGD = "fgd"  # Focus Group Discussion
    KII = "kii"  # Key Informant Interview
    IDI = "idi"  # In-Depth Interview
    OBSERVATION = "observation"
    OTHER = "other"


class CodeType(str, Enum):
    DESCRIPTIVE = "descriptive"
    INTERPRETIVE = "interpretive"
    PROCESS = "process"
    VALUE = "value"
    EMOTION = "emotion"
    IN_VIVO = "in_vivo"
    STRUCTURAL = "structural"


class Polarity(str, Enum):
    POSITIVE = "positive"
    NEGATIVE = "negative"
    MIXED = "mixed"
    NEUTRAL = "neutral"


class ThemeStatus(str, Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    APPROVED = "approved"


class CodingStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REVIEWED = "reviewed"


# =============================================================================
# PROJECT
# =============================================================================

class QualProjectCreate(BaseModel):
    name: str = Field(..., description="Project name")
    description: Optional[str] = None
    research_questions: Optional[List[str]] = None
    methodology: Optional[str] = None  # e.g., "Thematic Analysis", "Framework Analysis", "Grounded Theory"
    settings: Optional[Dict[str, Any]] = None


class QualProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    research_questions: Optional[List[str]] = None
    methodology: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class QualProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    research_questions: Optional[List[str]]
    methodology: Optional[str]
    source_count: int = 0
    code_count: int = 0
    coding_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by: str
    org_id: str


# =============================================================================
# SOURCE (Document/Transcript)
# =============================================================================

class Speaker(BaseModel):
    id: str
    name: str
    role: Optional[str] = None  # e.g., "Interviewer", "Participant", "Moderator"


class Utterance(BaseModel):
    id: str
    speaker_id: Optional[str] = None
    text: str
    start_time: Optional[float] = None  # seconds
    end_time: Optional[float] = None
    start_char: int
    end_char: int
    paragraph_index: int


class SourceCreate(BaseModel):
    project_id: str
    name: str
    source_type: SourceType = SourceType.TRANSCRIPT
    content: str = Field(..., description="Full text content")
    
    # Metadata
    language: Optional[str] = "en"
    date_collected: Optional[datetime] = None
    interviewer: Optional[str] = None
    site: Optional[str] = None
    participant_id: Optional[str] = None
    participant_pseudonym: Optional[str] = None
    wave: Optional[str] = None
    group_type: Optional[GroupType] = None
    
    # Consent & Ethics
    consent_verbatim_quotes: bool = True
    consent_audio_retention: bool = False
    contains_pii: bool = False
    
    # Speakers (for transcripts)
    speakers: Optional[List[Speaker]] = None
    
    # Media attachment
    media_url: Optional[str] = None
    media_duration: Optional[float] = None
    
    # Custom attributes
    attributes: Optional[Dict[str, Any]] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    language: Optional[str] = None
    date_collected: Optional[datetime] = None
    interviewer: Optional[str] = None
    site: Optional[str] = None
    participant_id: Optional[str] = None
    participant_pseudonym: Optional[str] = None
    wave: Optional[str] = None
    group_type: Optional[GroupType] = None
    consent_verbatim_quotes: Optional[bool] = None
    consent_audio_retention: Optional[bool] = None
    contains_pii: Optional[bool] = None
    speakers: Optional[List[Speaker]] = None
    attributes: Optional[Dict[str, Any]] = None


class SourceResponse(BaseModel):
    id: str
    project_id: str
    name: str
    source_type: SourceType
    content: str
    word_count: int
    utterance_count: int
    language: Optional[str]
    date_collected: Optional[datetime]
    interviewer: Optional[str]
    site: Optional[str]
    participant_id: Optional[str]
    participant_pseudonym: Optional[str]
    wave: Optional[str]
    group_type: Optional[GroupType]
    consent_verbatim_quotes: bool
    consent_audio_retention: bool
    contains_pii: bool
    speakers: Optional[List[Speaker]]
    utterances: Optional[List[Utterance]]
    media_url: Optional[str]
    attributes: Optional[Dict[str, Any]]
    coding_status: CodingStatus
    coding_count: int
    created_at: datetime
    updated_at: datetime


# =============================================================================
# CODEBOOK
# =============================================================================

class CodeCreate(BaseModel):
    project_id: str
    name: str
    definition: Optional[str] = None
    description: Optional[str] = None
    inclusion_criteria: Optional[str] = None
    exclusion_criteria: Optional[str] = None
    examples: Optional[List[str]] = None
    
    parent_id: Optional[str] = None  # For hierarchy
    code_type: CodeType = CodeType.DESCRIPTIVE
    polarity: Optional[Polarity] = None
    color: Optional[str] = "#3B82F6"  # Default blue
    
    is_sensitive: bool = False  # PII/safeguarding flag
    shortcut: Optional[str] = None  # Keyboard shortcut


class CodeUpdate(BaseModel):
    name: Optional[str] = None
    definition: Optional[str] = None
    description: Optional[str] = None
    inclusion_criteria: Optional[str] = None
    exclusion_criteria: Optional[str] = None
    examples: Optional[List[str]] = None
    parent_id: Optional[str] = None
    code_type: Optional[CodeType] = None
    polarity: Optional[Polarity] = None
    color: Optional[str] = None
    is_sensitive: Optional[bool] = None
    shortcut: Optional[str] = None
    sort_order: Optional[int] = None


class CodeResponse(BaseModel):
    id: str
    project_id: str
    name: str
    definition: Optional[str]
    description: Optional[str]
    inclusion_criteria: Optional[str]
    exclusion_criteria: Optional[str]
    examples: Optional[List[str]]
    parent_id: Optional[str]
    children: Optional[List['CodeResponse']] = None
    code_type: CodeType
    polarity: Optional[Polarity]
    color: str
    is_sensitive: bool
    shortcut: Optional[str]
    sort_order: int
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by: str


# =============================================================================
# CODING (Link between excerpt and code)
# =============================================================================

class CodingCreate(BaseModel):
    project_id: str
    source_id: str
    code_id: str
    
    # Excerpt location
    start_char: int
    end_char: int
    excerpt_text: str
    
    # Optional: utterance-based or timestamp-based
    utterance_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    
    # Coder input
    confidence: Optional[float] = None  # 0-1
    notes: Optional[str] = None  # Rationale for coding
    is_negative_case: bool = False


class CodingUpdate(BaseModel):
    code_id: Optional[str] = None
    confidence: Optional[float] = None
    notes: Optional[str] = None
    is_negative_case: Optional[bool] = None


class CodingResponse(BaseModel):
    id: str
    project_id: str
    source_id: str
    source_name: str
    code_id: str
    code_name: str
    code_color: str
    
    start_char: int
    end_char: int
    excerpt_text: str
    utterance_id: Optional[str]
    start_time: Optional[float]
    end_time: Optional[float]
    
    confidence: Optional[float]
    notes: Optional[str]
    is_negative_case: bool
    
    coder_id: str
    coder_name: str
    created_at: datetime
    updated_at: datetime


# =============================================================================
# MEMO
# =============================================================================

class MemoType(str, Enum):
    ANALYTIC = "analytic"
    METHODOLOGICAL = "methodological"
    THEORETICAL = "theoretical"
    REFLEXIVE = "reflexive"
    PROCEDURAL = "procedural"


class MemoCreate(BaseModel):
    project_id: str
    title: str
    content: str
    memo_type: MemoType = MemoType.ANALYTIC
    
    # Links (optional - can link to any object)
    linked_source_id: Optional[str] = None
    linked_code_id: Optional[str] = None
    linked_coding_id: Optional[str] = None
    linked_theme_id: Optional[str] = None
    
    tags: Optional[List[str]] = None


class MemoUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    memo_type: Optional[MemoType] = None
    linked_source_id: Optional[str] = None
    linked_code_id: Optional[str] = None
    linked_coding_id: Optional[str] = None
    linked_theme_id: Optional[str] = None
    tags: Optional[List[str]] = None


class MemoResponse(BaseModel):
    id: str
    project_id: str
    title: str
    content: str
    memo_type: MemoType
    linked_source_id: Optional[str]
    linked_code_id: Optional[str]
    linked_coding_id: Optional[str]
    linked_theme_id: Optional[str]
    tags: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    created_by: str


# =============================================================================
# THEME / FINDING
# =============================================================================

class EvidenceLink(BaseModel):
    coding_id: str
    excerpt_text: str
    source_name: str
    is_counter_evidence: bool = False


class ThemeCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    parent_id: Optional[str] = None  # For subthemes
    
    # Evidence
    supporting_evidence: Optional[List[str]] = None  # coding_ids
    counter_evidence: Optional[List[str]] = None  # coding_ids (negative cases)
    
    # Synthesis
    summary: Optional[str] = None
    implications: Optional[str] = None
    recommendations: Optional[str] = None


class ThemeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    status: Optional[ThemeStatus] = None
    supporting_evidence: Optional[List[str]] = None
    counter_evidence: Optional[List[str]] = None
    summary: Optional[str] = None
    implications: Optional[str] = None
    recommendations: Optional[str] = None


class ThemeResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str]
    parent_id: Optional[str]
    children: Optional[List['ThemeResponse']] = None
    status: ThemeStatus
    supporting_evidence: List[EvidenceLink]
    counter_evidence: List[EvidenceLink]
    summary: Optional[str]
    implications: Optional[str]
    recommendations: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: str


# =============================================================================
# QUERIES & RETRIEVAL
# =============================================================================

class CodeQuery(BaseModel):
    project_id: str
    code_ids: List[str]
    operator: str = "OR"  # OR, AND, NOT
    
    # Filters
    source_ids: Optional[List[str]] = None
    sites: Optional[List[str]] = None
    waves: Optional[List[str]] = None
    group_types: Optional[List[GroupType]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    
    # Options
    include_context: bool = True  # Include surrounding text
    context_chars: int = 100


class TextSearchQuery(BaseModel):
    project_id: str
    query: str
    search_type: str = "exact"  # exact, fuzzy, stemming
    
    # Filters
    source_ids: Optional[List[str]] = None
    code_ids: Optional[List[str]] = None  # Search within coded segments


class CoOccurrenceQuery(BaseModel):
    project_id: str
    code_id_1: str
    code_id_2: str
    proximity: Optional[int] = None  # Within N characters, None = same excerpt


class MatrixQuery(BaseModel):
    project_id: str
    row_attribute: str  # e.g., "site", "wave", "group_type"
    column_codes: List[str]  # code_ids


# =============================================================================
# EXPORTS
# =============================================================================

class CodebookExport(BaseModel):
    project_id: str
    format: str = "csv"  # csv, json, docx
    include_examples: bool = True
    include_usage_counts: bool = True


class ThemeReportExport(BaseModel):
    project_id: str
    theme_ids: Optional[List[str]] = None  # None = all themes
    format: str = "docx"  # docx, pdf, html
    include_quotes: bool = True
    include_counter_evidence: bool = True
    include_memos: bool = False
    anonymize_quotes: bool = False


# Enable forward references
CodeResponse.model_rebuild()
ThemeResponse.model_rebuild()
