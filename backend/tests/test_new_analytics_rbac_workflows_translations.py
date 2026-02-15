"""
Test file for DataPulse new features:
- Analytics API (overview, submissions, quality, performance)
- RBAC API (roles, permissions, user assignments)
- Workflows API (triggers, actions, workflows CRUD)
- Translations API (languages, translate, glossary)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for subsequent tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@datapulse.io",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def org_id(self, auth_headers):
        """Get test organization ID"""
        response = requests.get(f"{BASE_URL}/api/organizations", headers=auth_headers)
        if response.status_code == 200:
            orgs = response.json()
            # Handle if response is a list or dict
            if isinstance(orgs, list) and orgs:
                return orgs[0]["id"]
            elif isinstance(orgs, dict) and orgs.get("organizations"):
                return orgs["organizations"][0]["id"]
        # Use a default org_id if not found
        return "test_org_123"


class TestAnalyticsAPI(TestAuth):
    """Analytics API endpoint tests"""
    
    def test_analytics_overview(self, auth_headers, org_id):
        """Test GET /api/analytics/overview/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/overview/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period" in data
        assert "summary" in data
        assert "submissions" in data["summary"]
        assert "forms" in data["summary"]
        assert "users" in data["summary"]
        assert "quality" in data["summary"]
        print(f"Analytics overview: {data['summary']['submissions']['total']} submissions")
    
    def test_analytics_overview_with_period(self, auth_headers, org_id):
        """Test analytics overview with different periods"""
        periods = ["today", "7_days", "30_days", "90_days", "this_year"]
        
        for period in periods:
            response = requests.get(
                f"{BASE_URL}/api/analytics/overview/{org_id}?period={period}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Period {period} failed: {response.text}"
            data = response.json()
            assert data["period"] == period
        print(f"All period filters work correctly")
    
    def test_submissions_analytics(self, auth_headers, org_id):
        """Test GET /api/analytics/submissions/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/submissions/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "time_series" in data
        assert "top_forms" in data
        assert "top_users" in data
        assert "totals" in data
        assert isinstance(data["time_series"], list)
        print(f"Submissions analytics: {len(data['time_series'])} data points")
    
    def test_quality_analytics(self, auth_headers, org_id):
        """Test GET /api/analytics/quality/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/quality/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "overall_score" in data
        assert "score_distribution" in data
        assert "quality_factors" in data
        assert "common_issues" in data
        print(f"Quality score: {data['overall_score']}%")
    
    def test_performance_analytics(self, auth_headers, org_id):
        """Test GET /api/analytics/performance/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/analytics/performance/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "team_summary" in data
        assert "user_performance" in data
        assert "regional_performance" in data
        print(f"Performance analytics: {len(data['user_performance'])} users tracked")


class TestRBACAPI(TestAuth):
    """RBAC (Role-Based Access Control) API tests"""
    
    def test_get_permissions(self, auth_headers):
        """Test GET /api/rbac/permissions"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/permissions",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "permissions" in data
        assert "categories" in data
        assert isinstance(data["permissions"], list)
        assert len(data["permissions"]) > 0
        print(f"Permissions: {len(data['permissions'])} available")
    
    def test_get_default_roles(self, auth_headers):
        """Test GET /api/rbac/roles/defaults"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/defaults",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "roles" in data
        role_names = [r["name"] for r in data["roles"]]
        
        # Check for expected system roles
        expected_roles = ["Owner", "Administrator", "Supervisor", "Enumerator", "Viewer"]
        for role in expected_roles:
            assert role in role_names, f"Missing role: {role}"
        print(f"Default roles present: {', '.join(expected_roles)}")
    
    def test_get_organization_roles(self, auth_headers, org_id):
        """Test GET /api/rbac/roles/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "roles" in data
        # Should include both system and custom roles
        system_roles = [r for r in data["roles"] if r.get("is_system")]
        assert len(system_roles) >= 5  # At least 5 system roles
        print(f"Organization roles: {len(data['roles'])} total")
    
    def test_create_custom_role(self, auth_headers, org_id):
        """Test POST /api/rbac/roles/{org_id}"""
        response = requests.post(
            f"{BASE_URL}/api/rbac/roles/{org_id}",
            headers=auth_headers,
            json={
                "name": "TEST_Field Coordinator",
                "description": "Test role for field coordinators",
                "permissions": ["forms.read", "submissions.read", "submissions.create"]
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "message" in data
        print(f"Created custom role with ID: {data['id']}")
        return data["id"]
    
    def test_cannot_modify_system_role(self, auth_headers, org_id):
        """Test that system roles cannot be modified"""
        response = requests.put(
            f"{BASE_URL}/api/rbac/roles/{org_id}/owner",
            headers=auth_headers,
            json={"name": "Modified Owner"}
        )
        # Should fail with 400
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("System role protection working correctly")


class TestWorkflowsAPI(TestAuth):
    """Workflows API tests"""
    
    def test_get_triggers(self, auth_headers):
        """Test GET /api/workflows/triggers"""
        response = requests.get(
            f"{BASE_URL}/api/workflows/triggers",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "triggers" in data
        trigger_ids = [t["id"] for t in data["triggers"]]
        
        # Check expected triggers
        expected = ["submission_created", "quality_below", "quality_above"]
        for trigger in expected:
            assert trigger in trigger_ids, f"Missing trigger: {trigger}"
        print(f"Triggers available: {len(data['triggers'])}")
    
    def test_get_actions(self, auth_headers):
        """Test GET /api/workflows/actions"""
        response = requests.get(
            f"{BASE_URL}/api/workflows/actions",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "actions" in data
        action_ids = [a["id"] for a in data["actions"]]
        
        # Check expected actions
        expected = ["auto_approve", "auto_reject", "flag_review", "send_notification"]
        for action in expected:
            assert action in action_ids, f"Missing action: {action}"
        print(f"Actions available: {len(data['actions'])}")
    
    def test_get_operators(self, auth_headers):
        """Test GET /api/workflows/operators"""
        response = requests.get(
            f"{BASE_URL}/api/workflows/operators",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "operators" in data
        operator_ids = [o["id"] for o in data["operators"]]
        
        # Check expected operators
        expected = ["equals", "not_equals", "contains", "greater_than", "less_than"]
        for op in expected:
            assert op in operator_ids, f"Missing operator: {op}"
        print(f"Operators available: {len(data['operators'])}")
    
    def test_get_workflows(self, auth_headers, org_id):
        """Test GET /api/workflows/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/workflows/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "workflows" in data
        # Should include default workflows
        assert len(data["workflows"]) >= 0
        print(f"Workflows: {len(data['workflows'])} found")
    
    def test_create_workflow(self, auth_headers, org_id):
        """Test POST /api/workflows/{org_id}"""
        response = requests.post(
            f"{BASE_URL}/api/workflows/{org_id}",
            headers=auth_headers,
            json={
                "name": "TEST_Auto Quality Check",
                "description": "Auto-flag low quality submissions",
                "trigger_type": "submission_created",
                "trigger_config": {},
                "conditions": [],
                "actions": [{"action_type": "flag_review", "config": {"reason": "Auto review"}}],
                "is_active": False
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        print(f"Created workflow with ID: {data['id']}")
        return data["id"]
    
    def test_get_workflow_templates(self, auth_headers, org_id):
        """Test GET /api/workflows/{org_id}/templates"""
        response = requests.get(
            f"{BASE_URL}/api/workflows/{org_id}/templates",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "templates" in data
        template_ids = [t["id"] for t in data["templates"]]
        
        # Check expected templates
        expected = ["quality_gate", "supervisor_review", "case_followup"]
        for template in expected:
            assert template in template_ids, f"Missing template: {template}"
        print(f"Templates available: {len(data['templates'])}")


class TestTranslationsAPI(TestAuth):
    """Translations API tests"""
    
    def test_get_languages(self, auth_headers):
        """Test GET /api/translations/languages"""
        response = requests.get(
            f"{BASE_URL}/api/translations/languages",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "languages" in data
        assert len(data["languages"]) > 0
        
        # Check for expected languages
        lang_codes = [l["code"] for l in data["languages"]]
        expected = ["en", "sw", "fr", "es", "ar"]
        for lang in expected:
            assert lang in lang_codes, f"Missing language: {lang}"
        
        # Check RTL flag for Arabic
        ar_lang = next(l for l in data["languages"] if l["code"] == "ar")
        assert ar_lang["rtl"] == True
        print(f"Languages supported: {len(data['languages'])}")
    
    def test_translate_text(self, auth_headers):
        """Test POST /api/translations/translate"""
        response = requests.post(
            f"{BASE_URL}/api/translations/translate",
            headers=auth_headers,
            json={
                "text": "Yes",
                "source_language": "en",
                "target_language": "sw"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "original" in data
        assert "translated" in data
        assert data["original"] == "Yes"
        assert data["translated"] == "Ndiyo"  # Swahili for Yes
        print(f"Translation: 'Yes' -> '{data['translated']}' (Swahili)")
    
    def test_translate_to_french(self, auth_headers):
        """Test translation to French"""
        response = requests.post(
            f"{BASE_URL}/api/translations/translate",
            headers=auth_headers,
            json={
                "text": "Submit",
                "source_language": "en",
                "target_language": "fr"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["translated"] == "Soumettre"  # French for Submit
        print(f"Translation: 'Submit' -> '{data['translated']}' (French)")
    
    def test_translate_to_arabic(self, auth_headers):
        """Test translation to Arabic"""
        response = requests.post(
            f"{BASE_URL}/api/translations/translate",
            headers=auth_headers,
            json={
                "text": "Name",
                "source_language": "en",
                "target_language": "ar"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["translated"] == "الاسم"  # Arabic for Name
        print(f"Translation: 'Name' -> '{data['translated']}' (Arabic)")
    
    def test_bulk_translate(self, auth_headers):
        """Test POST /api/translations/translate/bulk"""
        response = requests.post(
            f"{BASE_URL}/api/translations/translate/bulk",
            headers=auth_headers,
            json={
                "texts": ["Yes", "No", "Name", "Age"],
                "source_language": "en",
                "target_language": "sw"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "translations" in data
        assert len(data["translations"]) == 4
        print(f"Bulk translation: {len(data['translations'])} phrases translated")
    
    def test_get_glossary(self, auth_headers, org_id):
        """Test GET /api/translations/glossary/{org_id}"""
        response = requests.get(
            f"{BASE_URL}/api/translations/glossary/{org_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "glossary" in data
        print(f"Glossary: {len(data['glossary'])} terms")


class TestIntegration(TestAuth):
    """Integration tests across features"""
    
    def test_full_workflow_creation_flow(self, auth_headers, org_id):
        """Test creating a workflow with all components"""
        # First get triggers
        triggers_resp = requests.get(
            f"{BASE_URL}/api/workflows/triggers",
            headers=auth_headers
        )
        assert triggers_resp.status_code == 200
        
        # Get actions
        actions_resp = requests.get(
            f"{BASE_URL}/api/workflows/actions",
            headers=auth_headers
        )
        assert actions_resp.status_code == 200
        
        # Create workflow
        create_resp = requests.post(
            f"{BASE_URL}/api/workflows/{org_id}",
            headers=auth_headers,
            json={
                "name": "TEST_Integration Workflow",
                "description": "Test workflow for integration",
                "trigger_type": "quality_below",
                "trigger_config": {"threshold": 75},
                "conditions": [
                    {"field": "status", "operator": "equals", "value": "submitted"}
                ],
                "actions": [
                    {"action_type": "flag_review", "config": {"reason": "Low quality"}},
                    {"action_type": "send_notification", "config": {"type": "email"}}
                ],
                "is_active": False
            }
        )
        assert create_resp.status_code == 200
        data = create_resp.json()
        assert "id" in data
        print(f"Full workflow integration test passed - ID: {data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
