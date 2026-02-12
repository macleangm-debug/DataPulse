"""
DataViz Studio - Data Seeding Script
Populates the database with sample organizations, users, projects, forms, and submissions
to enable full testing of the DataViz module.
"""
import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv
import hashlib

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


def generate_id():
    return str(uuid.uuid4())[:8]


def hash_password(password: str) -> str:
    """Simple password hashing for testing"""
    return hashlib.sha256(password.encode()).hexdigest()


# Sample data definitions
REGIONS = ["North", "South", "East", "West", "Central"]
GENDERS = ["Male", "Female", "Other"]
AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"]
EDUCATION_LEVELS = ["Primary", "Secondary", "University", "Post-graduate"]
INCOME_LEVELS = ["Low", "Medium", "High"]
SATISFACTION_LEVELS = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]
PRODUCTS = ["Product A", "Product B", "Product C", "Product D", "Product E"]


async def seed_database():
    """Main seeding function"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Starting database seeding for DataViz testing...")
    
    # 1. Create Organization
    org_id = generate_id()
    org = {
        "id": org_id,
        "name": "DataPulse Demo Organization",
        "slug": "datapulse-demo",
        "plan": "professional",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if org exists
    existing_org = await db.organizations.find_one({"slug": "datapulse-demo"})
    if existing_org:
        org_id = existing_org["id"]
        print(f"Using existing organization: {org_id}")
    else:
        await db.organizations.insert_one(org)
        print(f"Created organization: {org_id}")
    
    # 2. Create Admin User
    admin_user_id = generate_id()
    admin_user = {
        "id": admin_user_id,
        "email": "demo@datapulse.io",
        "name": "Demo Admin",
        "password_hash": hash_password("Test123!"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing_user = await db.users.find_one({"email": "demo@datapulse.io"})
    if existing_user:
        admin_user_id = existing_user["id"]
        print(f"Using existing admin user: {admin_user_id}")
    else:
        await db.users.insert_one(admin_user)
        print(f"Created admin user: {admin_user_id}")
    
    # 3. Create Org Membership
    existing_member = await db.org_members.find_one({"org_id": org_id, "user_id": admin_user_id})
    if not existing_member:
        await db.org_members.insert_one({
            "org_id": org_id,
            "user_id": admin_user_id,
            "role": "admin",
            "joined_at": datetime.now(timezone.utc).isoformat()
        })
        print(f"Created org membership for admin")
    
    # 4. Create Enumerator Users (5 enumerators)
    enumerator_ids = []
    enumerator_names = ["John Field", "Maria Garcia", "James Lee", "Sarah Brown", "Michael Chen"]
    
    for i, name in enumerate(enumerator_names):
        enum_email = f"enumerator{i+1}@datapulse.io"
        existing_enum = await db.users.find_one({"email": enum_email})
        
        if existing_enum:
            enumerator_ids.append(existing_enum["id"])
        else:
            enum_id = generate_id()
            await db.users.insert_one({
                "id": enum_id,
                "email": enum_email,
                "name": name,
                "password_hash": hash_password("field123"),
                "is_active": True,
                "role": "enumerator",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            enumerator_ids.append(enum_id)
            
            # Add org membership
            await db.org_members.insert_one({
                "org_id": org_id,
                "user_id": enum_id,
                "role": "enumerator",
                "joined_at": datetime.now(timezone.utc).isoformat()
            })
    
    print(f"Created/verified {len(enumerator_ids)} enumerators")
    
    # 5. Create Project
    project_id = generate_id()
    project = {
        "id": project_id,
        "name": "Customer Satisfaction Survey 2024",
        "description": "Annual customer satisfaction and market research survey",
        "org_id": org_id,
        "status": "active",
        "created_by": admin_user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing_project = await db.projects.find_one({"org_id": org_id, "name": "Customer Satisfaction Survey 2024"})
    if existing_project:
        project_id = existing_project["id"]
        print(f"Using existing project: {project_id}")
    else:
        await db.projects.insert_one(project)
        print(f"Created project: {project_id}")
    
    # 6. Create Forms
    forms = [
        {
            "name": "Customer Feedback Form",
            "description": "Collect customer satisfaction and feedback data",
            "fields": [
                {"name": "region", "label": "Region", "type": "select", "choices": REGIONS},
                {"name": "gender", "label": "Gender", "type": "select", "choices": GENDERS},
                {"name": "age_group", "label": "Age Group", "type": "select", "choices": AGE_GROUPS},
                {"name": "education", "label": "Education Level", "type": "select", "choices": EDUCATION_LEVELS},
                {"name": "income", "label": "Income Level", "type": "select", "choices": INCOME_LEVELS},
                {"name": "satisfaction", "label": "Overall Satisfaction", "type": "select", "choices": SATISFACTION_LEVELS},
                {"name": "product", "label": "Product Purchased", "type": "select", "choices": PRODUCTS},
                {"name": "rating", "label": "Rating (1-10)", "type": "number", "validation": {"min_value": 1, "max_value": 10}},
                {"name": "recommend", "label": "Would Recommend?", "type": "boolean"},
                {"name": "comments", "label": "Additional Comments", "type": "text"}
            ]
        },
        {
            "name": "Product Usage Survey",
            "description": "Track product usage patterns and preferences",
            "fields": [
                {"name": "region", "label": "Region", "type": "select", "choices": REGIONS},
                {"name": "product", "label": "Product", "type": "select", "choices": PRODUCTS},
                {"name": "usage_frequency", "label": "Usage Frequency", "type": "select", "choices": ["Daily", "Weekly", "Monthly", "Rarely"]},
                {"name": "purchase_channel", "label": "Purchase Channel", "type": "select", "choices": ["Online", "Retail Store", "Distributor", "Direct Sales"]},
                {"name": "spend_amount", "label": "Monthly Spend ($)", "type": "number", "validation": {"min_value": 0, "max_value": 10000}},
                {"name": "loyalty_member", "label": "Loyalty Member?", "type": "boolean"}
            ]
        }
    ]
    
    form_ids = []
    for form_data in forms:
        existing_form = await db.forms.find_one({"org_id": org_id, "name": form_data["name"]})
        if existing_form:
            form_ids.append(existing_form["id"])
            print(f"Using existing form: {form_data['name']}")
        else:
            form_id = generate_id()
            form = {
                "id": form_id,
                "name": form_data["name"],
                "description": form_data["description"],
                "project_id": project_id,
                "org_id": org_id,
                "version": 1,
                "status": "published",
                "fields": form_data["fields"],
                "default_language": "en",
                "languages": ["en"],
                "created_by": admin_user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "published_at": datetime.now(timezone.utc).isoformat()
            }
            await db.forms.insert_one(form)
            form_ids.append(form_id)
            print(f"Created form: {form_data['name']} ({form_id})")
    
    # 7. Generate Submissions (500 submissions over 30 days)
    print("\nGenerating submissions...")
    
    # Clear existing submissions for clean data
    delete_result = await db.submissions.delete_many({"org_id": org_id})
    print(f"Cleared {delete_result.deleted_count} existing submissions")
    
    submissions = []
    base_date = datetime.now(timezone.utc) - timedelta(days=30)
    
    for i in range(500):
        # Random date within last 30 days
        days_offset = random.randint(0, 30)
        hours_offset = random.randint(0, 23)
        submission_date = base_date + timedelta(days=days_offset, hours=hours_offset)
        
        # Pick random form
        form_idx = random.randint(0, len(forms) - 1)
        form_id = form_ids[form_idx]
        form_fields = forms[form_idx]["fields"]
        
        # Generate response data based on form fields
        responses = {}
        for field in form_fields:
            field_name = field["name"]
            field_type = field["type"]
            
            if field_type == "select":
                responses[field_name] = random.choice(field["choices"])
            elif field_type == "number":
                min_val = field.get("validation", {}).get("min_value", 0)
                max_val = field.get("validation", {}).get("max_value", 100)
                responses[field_name] = random.randint(min_val, max_val)
            elif field_type == "boolean":
                responses[field_name] = random.choice([True, False])
            elif field_type == "text":
                comments = [
                    "Great service!",
                    "Could be better",
                    "Very satisfied with the product",
                    "Average experience",
                    "Will recommend to friends",
                    "Needs improvement",
                    "Excellent quality",
                    "Good value for money",
                    "Fast delivery",
                    "Professional staff"
                ]
                responses[field_name] = random.choice(comments) if random.random() > 0.3 else ""
        
        # Pick random enumerator
        enumerator_id = random.choice(enumerator_ids)
        
        submission = {
            "id": generate_id(),
            "form_id": form_id,
            "form_version": 1,
            "data": responses,
            "responses": responses,  # Duplicate for compatibility with dataviz aggregation
            "org_id": org_id,
            "project_id": project_id,
            "submitted_by": enumerator_id,
            "enumerator_id": enumerator_id,
            "submitted_at": submission_date,
            "status": random.choices(["approved", "pending", "flagged"], weights=[0.8, 0.15, 0.05])[0],
            "quality_score": random.randint(70, 100),
            "quality_flags": []
        }
        
        submissions.append(submission)
        
        if (i + 1) % 100 == 0:
            print(f"  Generated {i + 1} submissions...")
    
    # Bulk insert submissions
    await db.submissions.insert_many(submissions)
    print(f"Inserted {len(submissions)} submissions")
    
    # 8. Create sample DataViz dashboard
    dashboard_id = generate_id()
    dashboard = {
        "id": dashboard_id,
        "name": "Customer Insights Dashboard",
        "description": "Overview of customer satisfaction metrics",
        "org_id": org_id,
        "widgets": [
            {
                "id": "w1",
                "type": "chart",
                "chart_type": "bar",
                "title": "Satisfaction by Region",
                "data_source": form_ids[0],
                "field": "satisfaction",
                "aggregation": "count",
                "group_by": "region",
                "position": {"x": 0, "y": 0, "w": 6, "h": 4}
            },
            {
                "id": "w2",
                "type": "chart",
                "chart_type": "pie",
                "title": "Gender Distribution",
                "data_source": form_ids[0],
                "field": "gender",
                "aggregation": "count",
                "position": {"x": 6, "y": 0, "w": 6, "h": 4}
            },
            {
                "id": "w3",
                "type": "chart",
                "chart_type": "line",
                "title": "Average Rating by Age Group",
                "data_source": form_ids[0],
                "field": "rating",
                "aggregation": "avg",
                "group_by": "age_group",
                "position": {"x": 0, "y": 4, "w": 12, "h": 4}
            }
        ],
        "layout": "grid",
        "is_public": False,
        "refresh_interval": 0,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    existing_dashboard = await db.dataviz_dashboards.find_one({"org_id": org_id, "name": "Customer Insights Dashboard"})
    if existing_dashboard:
        print(f"Dashboard already exists: {existing_dashboard['id']}")
    else:
        await db.dataviz_dashboards.insert_one(dashboard)
        print(f"Created sample dashboard: {dashboard_id}")
    
    # Summary
    print("\n" + "=" * 50)
    print("SEEDING COMPLETE!")
    print("=" * 50)
    print(f"\nOrganization ID: {org_id}")
    print(f"Project ID: {project_id}")
    print(f"Form IDs: {', '.join(form_ids)}")
    print(f"Total Submissions: {len(submissions)}")
    print(f"\nTest Credentials:")
    print(f"  Admin: demo@datapulse.io / Test123!")
    print(f"  Enumerator: enumerator1@datapulse.io / field123")
    print(f"\nYou can now test the DataViz Studio at:")
    print(f"  - Navigate to /dataviz in the frontend")
    print(f"  - Create new dashboards or view the sample dashboard")
    print(f"  - Try different chart types with the seeded data")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
