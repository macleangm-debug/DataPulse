"""
DataPulse Comprehensive E2E Test Suite - Iteration 14
Tests all major modules: Auth, Dashboard, Organizations, Projects, Forms, 
CATI, Backcheck, Token Surveys, Quality AI, Preload/Writeback, Datasets,
Security, RBAC, Analytics, Workflows, Translations, Admin
"""
import pytest
import requests
import os
from datetime import datetime
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@datapulse.io"
TEST_PASSWORD = "password123"

class TestAuthentication:
    """Authentication module tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == TEST_EMAIL
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        
    def test_get_current_user(self):
        """Test getting current user info"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_resp.json()["access_token"]
        
        # Get user info
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL


@pytest.fixture(scope="class")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="class")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="class")
def test_org_id(auth_headers):
    """Create or get test organization"""
    # Try to list existing orgs
    response = requests.get(f"{BASE_URL}/api/organizations", headers=auth_headers)
    if response.status_code == 200:
        orgs = response.json()
        if orgs:
            return orgs[0]["id"]
    
    # Create new org
    unique_name = f"TEST_Org_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/api/organizations", json={
        "name": unique_name,
        "description": "Test organization for automated testing"
    }, headers=auth_headers)
    
    if response.status_code == 200:
        return response.json()["id"]
    pytest.skip("Could not create test organization")


@pytest.fixture(scope="class")
def test_project_id(auth_headers, test_org_id):
    """Create or get test project"""
    # Try to list existing projects
    response = requests.get(f"{BASE_URL}/api/projects?org_id={test_org_id}", headers=auth_headers)
    if response.status_code == 200:
        projects = response.json()
        if projects:
            return projects[0]["id"]
    
    # Create new project
    unique_name = f"TEST_Project_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/api/projects", json={
        "name": unique_name,
        "org_id": test_org_id,
        "description": "Test project for automated testing"
    }, headers=auth_headers)
    
    if response.status_code == 200:
        return response.json()["id"]
    pytest.skip("Could not create test project")


@pytest.fixture(scope="class")
def test_form_id(auth_headers, test_project_id):
    """Create or get test form"""
    # Create a new form
    unique_name = f"TEST_Form_{uuid.uuid4().hex[:8]}"
    response = requests.post(f"{BASE_URL}/api/forms", json={
        "name": unique_name,
        "project_id": test_project_id,
        "description": "Test form",
        "default_language": "en",
        "languages": ["en"],
        "fields": [
            {"id": "q1", "type": "text", "label": "Name", "required": True},
            {"id": "q2", "type": "number", "label": "Age"}
        ]
    }, headers=auth_headers)
    
    if response.status_code == 200:
        return response.json()["id"]
    pytest.skip("Could not create test form")


class TestHealthCheck:
    """Health check endpoints"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"


class TestOrganizations:
    """Organization management tests"""
    
    def test_list_organizations(self, auth_headers):
        """Test listing organizations"""
        response = requests.get(f"{BASE_URL}/api/organizations", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_get_organization(self, auth_headers, test_org_id):
        """Test getting single organization"""
        response = requests.get(f"{BASE_URL}/api/organizations/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_org_id
        
    def test_get_org_members(self, auth_headers, test_org_id):
        """Test getting organization members"""
        response = requests.get(f"{BASE_URL}/api/organizations/{test_org_id}/members", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestProjects:
    """Project management tests"""
    
    def test_list_projects(self, auth_headers, test_org_id):
        """Test listing projects"""
        response = requests.get(f"{BASE_URL}/api/projects?org_id={test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_create_project(self, auth_headers, test_org_id):
        """Test creating project"""
        unique_name = f"TEST_Project_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/projects", json={
            "name": unique_name,
            "org_id": test_org_id,
            "description": "Test project"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert "id" in data
        
    def test_get_project(self, auth_headers, test_project_id):
        """Test getting single project"""
        response = requests.get(f"{BASE_URL}/api/projects/{test_project_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project_id


class TestForms:
    """Form management tests"""
    
    def test_list_forms(self, auth_headers, test_org_id):
        """Test listing forms"""
        response = requests.get(f"{BASE_URL}/api/forms?org_id={test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_create_form(self, auth_headers, test_project_id):
        """Test creating form"""
        unique_name = f"TEST_Form_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/forms", json={
            "name": unique_name,
            "project_id": test_project_id,
            "description": "Test form",
            "default_language": "en",
            "languages": ["en"],
            "fields": [
                {"id": "q1", "type": "text", "label": "Name", "required": True},
                {"id": "q2", "type": "number", "label": "Age"}
            ]
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert "id" in data


class TestDashboard:
    """Dashboard and analytics tests"""
    
    def test_get_dashboard_stats(self, auth_headers, test_org_id):
        """Test getting dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats?org_id={test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_projects" in data
        assert "total_forms" in data
        assert "total_submissions" in data
        
    def test_get_submission_trends(self, auth_headers, test_org_id):
        """Test getting submission trends"""
        response = requests.get(f"{BASE_URL}/api/dashboard/submission-trends?org_id={test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if data:
            assert "date" in data[0]
            assert "count" in data[0]
            
    def test_get_quality_metrics(self, auth_headers, test_org_id):
        """Test getting quality metrics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/quality-metrics?org_id={test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "avg_quality_score" in data
        assert "total_count" in data


class TestCATI:
    """CATI (Computer-Assisted Telephone Interviewing) tests"""
    
    def test_list_cati_projects(self, auth_headers, test_org_id):
        """Test listing CATI projects - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/cati/projects/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "projects" in data
        
    def test_create_cati_project(self, auth_headers, test_org_id, test_form_id):
        """Test creating CATI project"""
        unique_name = f"TEST_CATI_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/cati/projects", json={
            "org_id": test_org_id,
            "name": unique_name,
            "form_id": test_form_id,
            "description": "Test CATI project"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "project_id" in data
        
    def test_get_cati_workstation(self, auth_headers, test_org_id):
        """Test CATI workstation endpoint"""
        response = requests.get(f"{BASE_URL}/api/cati/workstation/status", headers=auth_headers)
        # May return empty data but should be valid endpoint
        assert response.status_code in [200, 404]


class TestBackcheck:
    """Back-check module tests"""
    
    def test_list_backcheck_configs(self, auth_headers, test_org_id):
        """Test listing back-check configurations - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/backcheck/configs/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configs" in data
        
    def test_create_backcheck_config(self, auth_headers, test_org_id, test_project_id, test_form_id):
        """Test creating back-check configuration"""
        unique_name = f"TEST_Backcheck_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/backcheck/configs", json={
            "org_id": test_org_id,
            "project_id": test_project_id,
            "form_id": test_form_id,
            "name": unique_name,
            "sample_percentage": 10,
            "sampling_method": "random",
            "verification_fields": ["q1", "q2"],
            "key_fields": ["q1"]
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "config_id" in data


class TestTokenSurveys:
    """Token/Panel survey distribution tests"""
    
    def test_list_distributions(self, auth_headers, test_org_id):
        """Test listing survey distributions - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/surveys/distributions/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "distributions" in data
        
    def test_create_distribution(self, auth_headers, test_org_id, test_form_id):
        """Test creating survey distribution"""
        unique_name = f"TEST_Dist_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/surveys/distributions", json={
            "org_id": test_org_id,
            "name": unique_name,
            "form_id": test_form_id,
            "mode": "token",
            "allow_multiple_submissions": False
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "distribution_id" in data


class TestQualityAI:
    """Quality AI monitoring tests"""
    
    def test_get_speeding_configs(self, auth_headers, test_org_id):
        """Test listing speeding configs"""
        response = requests.get(f"{BASE_URL}/api/quality-ai/speeding/configs/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        
    def test_create_speeding_config(self, auth_headers, test_org_id, test_form_id):
        """Test creating speeding detection config"""
        response = requests.post(f"{BASE_URL}/api/quality-ai/speeding/configs", json={
            "org_id": test_org_id,
            "form_id": test_form_id,
            "min_expected_time": 60,
            "warning_threshold": 0.7,
            "critical_threshold": 0.5
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
    def test_get_audio_audit_configs(self, auth_headers, test_org_id):
        """Test listing audio audit configs"""
        response = requests.get(f"{BASE_URL}/api/quality-ai/audio-audit/configs/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        
    def test_get_quality_alerts(self, auth_headers, test_org_id):
        """Test getting quality alerts"""
        response = requests.get(f"{BASE_URL}/api/quality-ai/alerts/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        
    def test_get_alert_summary(self, auth_headers, test_org_id):
        """Test getting alert summary"""
        response = requests.get(f"{BASE_URL}/api/quality-ai/alerts/{test_org_id}/summary", headers=auth_headers)
        assert response.status_code == 200


class TestPreloadWriteback:
    """Preload/Writeback configuration tests"""
    
    def test_list_preload_configs(self, auth_headers, test_org_id):
        """Test listing preload configs - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/preload/configs/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "configs" in data
        
    def test_create_preload_config(self, auth_headers, test_org_id, test_form_id):
        """Test creating preload config"""
        unique_name = f"TEST_Preload_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/preload/configs", json={
            "org_id": test_org_id,
            "form_id": test_form_id,
            "name": unique_name,
            "sources": [],
            "mappings": []
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "config_id" in data


class TestDatasets:
    """Lookup datasets tests"""
    
    def test_list_datasets(self, auth_headers, test_org_id):
        """Test listing datasets - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/datasets/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "datasets" in data
        
    def test_create_dataset(self, auth_headers, test_org_id):
        """Test creating dataset"""
        unique_name = f"TEST_Dataset_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/datasets/", json={
            "org_id": test_org_id,
            "name": unique_name,
            "description": "Test dataset",
            "columns": [
                {"name": "id", "type": "string", "required": True},
                {"name": "value", "type": "number"}
            ],
            "searchable_fields": ["id"],
            "display_field": "id",
            "value_field": "id"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "dataset_id" in data


class TestAnalytics:
    """Analytics module tests"""
    
    def test_get_analytics_overview(self, auth_headers, test_org_id):
        """Test getting analytics overview - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200


class TestRBAC:
    """Role-based access control tests"""
    
    def test_get_permissions(self, auth_headers):
        """Test getting permissions list"""
        response = requests.get(f"{BASE_URL}/api/rbac/permissions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        
    def test_get_default_roles(self, auth_headers):
        """Test getting default roles"""
        response = requests.get(f"{BASE_URL}/api/rbac/roles/defaults", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "roles" in data
        
    def test_list_org_roles(self, auth_headers, test_org_id):
        """Test listing roles for org - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/rbac/roles/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200


class TestWorkflows:
    """Workflow automation tests"""
    
    def test_get_trigger_types(self, auth_headers):
        """Test getting workflow trigger types"""
        response = requests.get(f"{BASE_URL}/api/workflows/triggers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "triggers" in data
        
    def test_get_action_types(self, auth_headers):
        """Test getting workflow action types"""
        response = requests.get(f"{BASE_URL}/api/workflows/actions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
        
    def test_list_workflows(self, auth_headers, test_org_id):
        """Test listing workflows - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/workflows/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "workflows" in data
        
    def test_get_workflow_templates(self, auth_headers, test_org_id):
        """Test getting workflow templates"""
        response = requests.get(f"{BASE_URL}/api/workflows/{test_org_id}/templates", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data


class TestTranslations:
    """Translation management tests"""
    
    def test_get_supported_languages(self, auth_headers):
        """Test getting supported languages"""
        response = requests.get(f"{BASE_URL}/api/translations/languages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "languages" in data
        
    def test_translate_text(self, auth_headers):
        """Test translating text"""
        response = requests.post(f"{BASE_URL}/api/translations/translate", json={
            "text": "Yes",
            "source_language": "en",
            "target_language": "sw"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "translated" in data


class TestSecurity:
    """Security and API key management tests"""
    
    def test_list_api_keys(self, auth_headers, test_org_id):
        """Test listing API keys - uses path param /{org_id}"""
        response = requests.get(f"{BASE_URL}/api/security/api-keys/{test_org_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "keys" in data


class TestAdmin:
    """Super admin tests (may require superadmin role)"""
    
    def test_admin_dashboard(self, auth_headers):
        """Test admin dashboard endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers)
        # May return 403 if not superadmin, but endpoint should exist
        assert response.status_code in [200, 403]
        
    def test_admin_organizations(self, auth_headers):
        """Test admin orgs listing"""
        response = requests.get(f"{BASE_URL}/api/admin/organizations", headers=auth_headers)
        assert response.status_code in [200, 403]


class TestParadata:
    """Paradata (field operation metadata) tests"""
    
    def test_create_paradata_session(self, auth_headers, test_form_id):
        """Test creating paradata session"""
        response = requests.post(f"{BASE_URL}/api/paradata/sessions", json={
            "submission_id": f"test_sub_{uuid.uuid4().hex[:8]}",
            "form_id": test_form_id,
            "enumerator_id": "test_enum",
            "device_id": "test_device"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data


class TestRevisions:
    """Submission revision tests"""
    
    def test_create_correction_request(self, auth_headers):
        """Test creating correction request (will fail if no submission, but endpoint should work)"""
        response = requests.post(f"{BASE_URL}/api/revisions/correction-requests", json={
            "submission_id": "nonexistent",
            "requested_by": "test_user",
            "fields_to_correct": ["q1"],
            "notes": "Please correct"
        }, headers=auth_headers)
        # Will return 404 for nonexistent submission, which is correct behavior
        assert response.status_code in [200, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
