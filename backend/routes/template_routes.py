"""DataPulse - Form Templates Routes
Pre-built form templates for common use cases
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/templates", tags=["Templates"])


# Pre-defined templates
FORM_TEMPLATES = [
    {
        "id": "household-survey",
        "name": "Household Survey",
        "description": "Standard household demographics and socioeconomic survey",
        "category": "Demographics",
        "icon": "home",
        "fields": [
            {
                "id": "hh_id",
                "type": "text",
                "name": "hh_id",
                "labels": {"en": "Household ID", "sw": "Kitambulisho cha Kaya"},
                "required": True
            },
            {
                "id": "respondent_name",
                "type": "text",
                "name": "respondent_name",
                "labels": {"en": "Respondent Name", "sw": "Jina la Mhojiwa"},
                "required": True
            },
            {
                "id": "head_of_household",
                "type": "text",
                "name": "head_of_household",
                "labels": {"en": "Head of Household", "sw": "Mkuu wa Kaya"}
            },
            {
                "id": "hh_size",
                "type": "number",
                "name": "hh_size",
                "labels": {"en": "Household Size", "sw": "Idadi ya Watu"},
                "validation": {"min": 1, "max": 50}
            },
            {
                "id": "location",
                "type": "gps",
                "name": "location",
                "labels": {"en": "GPS Location", "sw": "Eneo la GPS"},
                "required": True
            },
            {
                "id": "dwelling_type",
                "type": "select",
                "name": "dwelling_type",
                "labels": {"en": "Type of Dwelling", "sw": "Aina ya Makazi"},
                "options": [
                    {"value": "permanent", "labels": {"en": "Permanent House", "sw": "Nyumba ya Kudumu"}},
                    {"value": "semi_permanent", "labels": {"en": "Semi-Permanent", "sw": "Nusu ya Kudumu"}},
                    {"value": "temporary", "labels": {"en": "Temporary Structure", "sw": "Kibanda"}}
                ]
            },
            {
                "id": "water_source",
                "type": "select",
                "name": "water_source",
                "labels": {"en": "Main Water Source", "sw": "Chanzo cha Maji"},
                "options": [
                    {"value": "piped", "labels": {"en": "Piped Water", "sw": "Maji ya Bomba"}},
                    {"value": "well", "labels": {"en": "Well", "sw": "Kisima"}},
                    {"value": "river", "labels": {"en": "River/Stream", "sw": "Mto"}},
                    {"value": "rainwater", "labels": {"en": "Rainwater", "sw": "Maji ya Mvua"}}
                ]
            },
            {
                "id": "photo",
                "type": "photo",
                "name": "photo",
                "labels": {"en": "Photo of Dwelling", "sw": "Picha ya Makazi"}
            }
        ]
    },
    {
        "id": "health-screening",
        "name": "Health Screening",
        "description": "Basic health screening and vitals collection",
        "category": "Health",
        "icon": "heart-pulse",
        "fields": [
            {
                "id": "patient_id",
                "type": "text",
                "name": "patient_id",
                "labels": {"en": "Patient ID", "sw": "Nambari ya Mgonjwa"},
                "required": True
            },
            {
                "id": "patient_name",
                "type": "text",
                "name": "patient_name",
                "labels": {"en": "Patient Name", "sw": "Jina la Mgonjwa"},
                "required": True
            },
            {
                "id": "age",
                "type": "number",
                "name": "age",
                "labels": {"en": "Age (years)", "sw": "Umri (miaka)"},
                "validation": {"min": 0, "max": 120},
                "required": True
            },
            {
                "id": "gender",
                "type": "radio",
                "name": "gender",
                "labels": {"en": "Gender", "sw": "Jinsia"},
                "options": [
                    {"value": "male", "labels": {"en": "Male", "sw": "Mwanaume"}},
                    {"value": "female", "labels": {"en": "Female", "sw": "Mwanamke"}}
                ],
                "required": True
            },
            {
                "id": "weight",
                "type": "number",
                "name": "weight",
                "labels": {"en": "Weight (kg)", "sw": "Uzito (kg)"},
                "hints": {"en": "Enter weight in kilograms", "sw": "Ingiza uzito kwa kilogramu"},
                "validation": {"min": 1, "max": 300}
            },
            {
                "id": "height",
                "type": "number",
                "name": "height",
                "labels": {"en": "Height (cm)", "sw": "Urefu (cm)"},
                "validation": {"min": 30, "max": 250}
            },
            {
                "id": "bmi",
                "type": "calculate",
                "name": "bmi",
                "labels": {"en": "BMI", "sw": "BMI"},
                "calculation": "round(weight / ((height/100) * (height/100)), 1)"
            },
            {
                "id": "blood_pressure_systolic",
                "type": "number",
                "name": "blood_pressure_systolic",
                "labels": {"en": "Blood Pressure (Systolic)", "sw": "Shinikizo la Damu (Juu)"},
                "validation": {"min": 60, "max": 250}
            },
            {
                "id": "blood_pressure_diastolic",
                "type": "number",
                "name": "blood_pressure_diastolic",
                "labels": {"en": "Blood Pressure (Diastolic)", "sw": "Shinikizo la Damu (Chini)"},
                "validation": {"min": 40, "max": 150}
            },
            {
                "id": "symptoms",
                "type": "checkbox",
                "name": "symptoms",
                "labels": {"en": "Current Symptoms", "sw": "Dalili za Sasa"},
                "options": [
                    {"value": "fever", "labels": {"en": "Fever", "sw": "Homa"}},
                    {"value": "cough", "labels": {"en": "Cough", "sw": "Kikohozi"}},
                    {"value": "headache", "labels": {"en": "Headache", "sw": "Maumivu ya Kichwa"}},
                    {"value": "fatigue", "labels": {"en": "Fatigue", "sw": "Uchovu"}},
                    {"value": "none", "labels": {"en": "None", "sw": "Hakuna"}}
                ]
            }
        ]
    },
    {
        "id": "customer-feedback",
        "name": "Customer Feedback",
        "description": "Customer satisfaction and feedback survey",
        "category": "Business",
        "icon": "message-square",
        "fields": [
            {
                "id": "customer_name",
                "type": "text",
                "name": "customer_name",
                "labels": {"en": "Customer Name", "sw": "Jina la Mteja"}
            },
            {
                "id": "email",
                "type": "text",
                "name": "email",
                "labels": {"en": "Email Address", "sw": "Barua Pepe"},
                "validation": {"pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}
            },
            {
                "id": "visit_date",
                "type": "date",
                "name": "visit_date",
                "labels": {"en": "Date of Visit", "sw": "Tarehe ya Ziara"}
            },
            {
                "id": "overall_rating",
                "type": "radio",
                "name": "overall_rating",
                "labels": {"en": "Overall Satisfaction", "sw": "Kuridhika kwa Jumla"},
                "options": [
                    {"value": "5", "labels": {"en": "Excellent", "sw": "Bora Sana"}},
                    {"value": "4", "labels": {"en": "Good", "sw": "Nzuri"}},
                    {"value": "3", "labels": {"en": "Average", "sw": "Wastani"}},
                    {"value": "2", "labels": {"en": "Poor", "sw": "Mbaya"}},
                    {"value": "1", "labels": {"en": "Very Poor", "sw": "Mbaya Sana"}}
                ],
                "required": True
            },
            {
                "id": "service_quality",
                "type": "radio",
                "name": "service_quality",
                "labels": {"en": "Service Quality", "sw": "Ubora wa Huduma"},
                "options": [
                    {"value": "5", "labels": {"en": "Excellent", "sw": "Bora Sana"}},
                    {"value": "4", "labels": {"en": "Good", "sw": "Nzuri"}},
                    {"value": "3", "labels": {"en": "Average", "sw": "Wastani"}},
                    {"value": "2", "labels": {"en": "Poor", "sw": "Mbaya"}},
                    {"value": "1", "labels": {"en": "Very Poor", "sw": "Mbaya Sana"}}
                ]
            },
            {
                "id": "would_recommend",
                "type": "radio",
                "name": "would_recommend",
                "labels": {"en": "Would you recommend us?", "sw": "Je, ungetupendekeza?"},
                "options": [
                    {"value": "yes", "labels": {"en": "Yes", "sw": "Ndiyo"}},
                    {"value": "no", "labels": {"en": "No", "sw": "Hapana"}},
                    {"value": "maybe", "labels": {"en": "Maybe", "sw": "Labda"}}
                ]
            },
            {
                "id": "comments",
                "type": "textarea",
                "name": "comments",
                "labels": {"en": "Additional Comments", "sw": "Maoni Zaidi"},
                "hints": {"en": "Please share any additional feedback", "sw": "Tafadhali shiriki maoni yoyote"}
            }
        ]
    },
    {
        "id": "event-registration",
        "name": "Event Registration",
        "description": "Event attendee registration form",
        "category": "Events",
        "icon": "calendar",
        "fields": [
            {
                "id": "full_name",
                "type": "text",
                "name": "full_name",
                "labels": {"en": "Full Name", "sw": "Jina Kamili"},
                "required": True
            },
            {
                "id": "email",
                "type": "text",
                "name": "email",
                "labels": {"en": "Email", "sw": "Barua Pepe"},
                "required": True
            },
            {
                "id": "phone",
                "type": "text",
                "name": "phone",
                "labels": {"en": "Phone Number", "sw": "Nambari ya Simu"}
            },
            {
                "id": "organization",
                "type": "text",
                "name": "organization",
                "labels": {"en": "Organization", "sw": "Shirika"}
            },
            {
                "id": "job_title",
                "type": "text",
                "name": "job_title",
                "labels": {"en": "Job Title", "sw": "Cheo"}
            },
            {
                "id": "dietary_requirements",
                "type": "checkbox",
                "name": "dietary_requirements",
                "labels": {"en": "Dietary Requirements", "sw": "Mahitaji ya Chakula"},
                "options": [
                    {"value": "vegetarian", "labels": {"en": "Vegetarian", "sw": "Mboga tu"}},
                    {"value": "vegan", "labels": {"en": "Vegan", "sw": "Vegan"}},
                    {"value": "halal", "labels": {"en": "Halal", "sw": "Halali"}},
                    {"value": "gluten_free", "labels": {"en": "Gluten-Free", "sw": "Bila Gluten"}},
                    {"value": "none", "labels": {"en": "No special requirements", "sw": "Hakuna mahitaji"}}
                ]
            },
            {
                "id": "sessions",
                "type": "checkbox",
                "name": "sessions",
                "labels": {"en": "Sessions to Attend", "sw": "Vikao vya Kuhudhuria"},
                "options": [
                    {"value": "morning", "labels": {"en": "Morning Session", "sw": "Kikao cha Asubuhi"}},
                    {"value": "afternoon", "labels": {"en": "Afternoon Session", "sw": "Kikao cha Mchana"}},
                    {"value": "networking", "labels": {"en": "Networking Event", "sw": "Tukio la Mitandao"}}
                ]
            }
        ]
    },
    {
        "id": "agriculture-survey",
        "name": "Agriculture Survey",
        "description": "Farm and crop data collection",
        "category": "Agriculture",
        "icon": "leaf",
        "fields": [
            {
                "id": "farmer_id",
                "type": "text",
                "name": "farmer_id",
                "labels": {"en": "Farmer ID", "sw": "Nambari ya Mkulima"},
                "required": True
            },
            {
                "id": "farmer_name",
                "type": "text",
                "name": "farmer_name",
                "labels": {"en": "Farmer Name", "sw": "Jina la Mkulima"},
                "required": True
            },
            {
                "id": "farm_location",
                "type": "gps",
                "name": "farm_location",
                "labels": {"en": "Farm GPS Location", "sw": "Eneo la Shamba"},
                "required": True
            },
            {
                "id": "farm_size",
                "type": "number",
                "name": "farm_size",
                "labels": {"en": "Farm Size (acres)", "sw": "Ukubwa wa Shamba (ekari)"},
                "validation": {"min": 0.1, "max": 10000}
            },
            {
                "id": "main_crop",
                "type": "select",
                "name": "main_crop",
                "labels": {"en": "Main Crop", "sw": "Zao Kuu"},
                "options": [
                    {"value": "maize", "labels": {"en": "Maize", "sw": "Mahindi"}},
                    {"value": "rice", "labels": {"en": "Rice", "sw": "Mchele"}},
                    {"value": "beans", "labels": {"en": "Beans", "sw": "Maharagwe"}},
                    {"value": "wheat", "labels": {"en": "Wheat", "sw": "Ngano"}},
                    {"value": "vegetables", "labels": {"en": "Vegetables", "sw": "Mboga"}},
                    {"value": "fruits", "labels": {"en": "Fruits", "sw": "Matunda"}},
                    {"value": "other", "labels": {"en": "Other", "sw": "Nyingine"}}
                ]
            },
            {
                "id": "irrigation",
                "type": "radio",
                "name": "irrigation",
                "labels": {"en": "Irrigation Method", "sw": "Njia ya Umwagiliaji"},
                "options": [
                    {"value": "rain_fed", "labels": {"en": "Rain-fed", "sw": "Mvua"}},
                    {"value": "drip", "labels": {"en": "Drip Irrigation", "sw": "Umwagiliaji wa Matone"}},
                    {"value": "sprinkler", "labels": {"en": "Sprinkler", "sw": "Mnyunyizio"}},
                    {"value": "flood", "labels": {"en": "Flood Irrigation", "sw": "Umwagiliaji wa Mafuriko"}}
                ]
            },
            {
                "id": "yield_estimate",
                "type": "number",
                "name": "yield_estimate",
                "labels": {"en": "Estimated Yield (kg)", "sw": "Makadirio ya Mavuno (kg)"},
                "validation": {"min": 0}
            },
            {
                "id": "farm_photo",
                "type": "photo",
                "name": "farm_photo",
                "labels": {"en": "Photo of Farm/Crops", "sw": "Picha ya Shamba/Mazao"}
            }
        ]
    }
]


def get_db():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "datapulse")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


@router.get("/")
async def list_templates(category: Optional[str] = None):
    """List all available form templates"""
    templates = FORM_TEMPLATES
    
    if category:
        templates = [t for t in templates if t.get("category", "").lower() == category.lower()]
    
    # Return summary without full fields
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "category": t["category"],
            "icon": t["icon"],
            "field_count": len(t["fields"])
        }
        for t in templates
    ]


@router.get("/categories")
async def list_categories():
    """List all template categories"""
    categories = set(t.get("category", "Other") for t in FORM_TEMPLATES)
    return sorted(list(categories))


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get a specific template with all fields"""
    template = next((t for t in FORM_TEMPLATES if t["id"] == template_id), None)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.post("/{template_id}/create-form")
async def create_form_from_template(
    template_id: str,
    project_id: str,
    form_name: Optional[str] = None
):
    """Create a new form from a template"""
    db = get_db()
    
    # Find template
    template = next((t for t in FORM_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Generate new field IDs
    import copy
    fields = copy.deepcopy(template["fields"])
    for field in fields:
        field["id"] = str(uuid.uuid4())[:8]
    
    # Create form
    form_id = str(uuid.uuid4())
    form = {
        "id": form_id,
        "name": form_name or f"{template['name']} Copy",
        "description": template["description"],
        "project_id": project_id,
        "fields": fields,
        "status": "draft",
        "version": 1,
        "created_from_template": template_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.forms.insert_one(form)
    
    # Remove _id for response
    form.pop("_id", None)
    
    return form


@router.post("/custom")
async def save_custom_template(
    name: str,
    description: str,
    category: str,
    form_id: str,
    org_id: str
):
    """Save an existing form as a custom template"""
    db = get_db()
    
    # Get the form
    form = await db.forms.find_one({"id": form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Create custom template
    template_id = str(uuid.uuid4())
    custom_template = {
        "id": template_id,
        "name": name,
        "description": description,
        "category": category,
        "icon": "file-text",
        "fields": form.get("fields", []),
        "org_id": org_id,
        "created_from_form": form_id,
        "is_custom": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_templates.insert_one(custom_template)
    
    custom_template.pop("_id", None)
    
    return custom_template


@router.get("/custom/org/{org_id}")
async def list_custom_templates(org_id: str):
    """List custom templates for an organization"""
    db = get_db()
    
    templates = await db.custom_templates.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(100)
    
    return templates
