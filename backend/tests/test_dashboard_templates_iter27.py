"""
Dashboard Templates API Tests - Iteration 27
Tests for preset templates and user-created templates functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"


class TestDashboardTemplatesAPI:
    """Dashboard Templates endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token") or response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_list_templates_returns_preset_templates(self):
        """GET /api/dashboard-templates - Should return 6 preset templates"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Data assertions
        data = response.json()
        assert "preset" in data, "Response should contain 'preset' field"
        assert "custom" in data, "Response should contain 'custom' field"
        
        preset_templates = data["preset"]
        assert isinstance(preset_templates, list), "preset should be a list"
        assert len(preset_templates) == 10, f"Expected 10 preset templates, got {len(preset_templates)}"
        
        # Verify preset template structure - now includes more templates
        expected_preset_ids = ["preset_sales", "preset_marketing", "preset_customers", 
                              "preset_operations", "preset_financial", "preset_analytics",
                              "preset_executive", "preset_project", "preset_support", "preset_blank"]
        actual_ids = [t["id"] for t in preset_templates]
        
        for preset_id in expected_preset_ids:
            assert preset_id in actual_ids, f"Missing expected preset: {preset_id}"
        
        # Verify each template has required fields
        for template in preset_templates:
            assert "id" in template, "Template should have 'id'"
            assert "name" in template, "Template should have 'name'"
            assert "description" in template, "Template should have 'description'"
            assert "icon" in template, "Template should have 'icon'"
            assert "color" in template, "Template should have 'color'"
            assert "is_preset" in template, "Template should have 'is_preset'"
            assert "widgets" in template, "Template should have 'widgets'"
            assert template["is_preset"] == True, "Preset templates should have is_preset=True"
    
    def test_list_templates_preset_content(self):
        """Verify preset templates have correct content"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        assert response.status_code == 200
        
        data = response.json()
        preset_templates = data["preset"]
        
        # Find Sales Dashboard template
        sales_template = next((t for t in preset_templates if t["id"] == "preset_sales"), None)
        assert sales_template is not None, "Sales Dashboard template should exist"
        assert sales_template["name"] == "Sales Dashboard"
        assert sales_template["icon"] == "DollarSign"
        assert len(sales_template["widgets"]) == 9, "Sales template should have 9 widgets"
        
        # Find Blank Canvas template
        blank_template = next((t for t in preset_templates if t["id"] == "preset_blank"), None)
        assert blank_template is not None, "Blank Canvas template should exist"
        assert blank_template["name"] == "Blank Canvas"
        assert len(blank_template["widgets"]) == 0, "Blank template should have 0 widgets"
    
    def test_create_custom_template(self):
        """POST /api/dashboard-templates - Should create a custom template"""
        template_data = {
            "name": "TEST_Custom Template",
            "description": "Test custom template description",
            "widgets": [
                {"type": "stat", "title": "Test Stat", "config": {"aggregation": "count"}, "position": {"x": 0, "y": 0, "w": 3, "h": 2}}
            ],
            "icon": "LayoutDashboard",
            "color": "from-purple-500 to-purple-600"
        }
        
        response = self.session.post(f"{BASE_URL}/api/dashboard-templates", json=template_data)
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "message" in data, "Response should contain 'message'"
        assert data["message"] == "Template created"
        
        created_id = data["id"]
        assert isinstance(created_id, str) and len(created_id) > 0, "ID should be a non-empty string"
        
        # Verify persistence - GET templates and check custom list
        get_response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        assert get_response.status_code == 200
        
        custom_templates = get_response.json()["custom"]
        created_template = next((t for t in custom_templates if t["id"] == created_id), None)
        assert created_template is not None, "Created template should be in custom templates list"
        assert created_template["name"] == template_data["name"]
        assert created_template["description"] == template_data["description"]
        assert created_template["is_preset"] == False
        
        # Cleanup - delete the test template
        self.session.delete(f"{BASE_URL}/api/dashboard-templates/{created_id}")
    
    def test_get_single_preset_template(self):
        """GET /api/dashboard-templates/{id} - Should return a specific preset template"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates/preset_sales")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == "preset_sales"
        assert data["name"] == "Sales Dashboard"
        assert data["is_preset"] == True
    
    def test_delete_custom_template(self):
        """DELETE /api/dashboard-templates/{id} - Should delete a custom template"""
        # First create a template to delete
        template_data = {
            "name": "TEST_Template To Delete",
            "description": "This template will be deleted",
            "widgets": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/dashboard-templates", json=template_data)
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/dashboard-templates/{template_id}")
        
        # Status assertion
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion message
        data = delete_response.json()
        assert data["message"] == "Template deleted"
        
        # Verify template no longer exists in list
        get_response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        assert get_response.status_code == 200
        
        custom_templates = get_response.json()["custom"]
        deleted_template = next((t for t in custom_templates if t["id"] == template_id), None)
        assert deleted_template is None, "Deleted template should not appear in list"
    
    def test_delete_nonexistent_template(self):
        """DELETE /api/dashboard-templates/{id} - Should return 404 for non-existent template"""
        response = self.session.delete(f"{BASE_URL}/api/dashboard-templates/nonexistent_template_id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_list_templates_without_auth(self):
        """GET /api/dashboard-templates - Should work without auth but return empty custom list"""
        # Create a new session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/dashboard-templates")
        
        # Should still work and return preset templates
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "preset" in data
        assert "custom" in data
        assert len(data["preset"]) == 10, "Should return 10 preset templates"
        # Custom should be empty without auth
        assert len(data["custom"]) == 0, "Custom templates should be empty without auth"
    
    def test_create_template_without_auth(self):
        """POST /api/dashboard-templates - Should require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        template_data = {
            "name": "TEST_Unauthorized Template",
            "description": "Should not be created",
            "widgets": []
        }
        
        response = session.post(f"{BASE_URL}/api/dashboard-templates", json=template_data)
        
        # Should be unauthorized
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_update_custom_template(self):
        """PUT /api/dashboard-templates/{id} - Should update template name and description"""
        # First create a template to update
        template_data = {
            "name": "TEST_Template To Update",
            "description": "Original description",
            "widgets": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/dashboard-templates", json=template_data)
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        template_id = create_response.json()["id"]
        
        # Update the template
        update_data = {
            "name": "TEST_Updated Template Name",
            "description": "Updated description"
        }
        
        update_response = self.session.put(
            f"{BASE_URL}/api/dashboard-templates/{template_id}",
            json=update_data
        )
        
        # Status assertion
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Data assertion
        data = update_response.json()
        assert data["message"] == "Template updated"
        
        # Verify persistence - GET to confirm update
        get_response = self.session.get(f"{BASE_URL}/api/dashboard-templates/{template_id}")
        assert get_response.status_code == 200
        
        updated_template = get_response.json()
        assert updated_template["name"] == update_data["name"], "Name should be updated"
        assert updated_template["description"] == update_data["description"], "Description should be updated"
        assert "updated_at" in updated_template, "Should have updated_at timestamp"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/dashboard-templates/{template_id}")
    
    def test_update_template_partial(self):
        """PUT /api/dashboard-templates/{id} - Should allow partial updates"""
        # First create a template
        template_data = {
            "name": "TEST_Partial Update",
            "description": "Original description",
            "widgets": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/dashboard-templates", json=template_data)
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Update only name
        update_response = self.session.put(
            f"{BASE_URL}/api/dashboard-templates/{template_id}",
            json={"name": "TEST_Only Name Updated"}
        )
        assert update_response.status_code == 200
        
        # Verify name changed but description unchanged
        get_response = self.session.get(f"{BASE_URL}/api/dashboard-templates/{template_id}")
        template = get_response.json()
        assert template["name"] == "TEST_Only Name Updated"
        assert template["description"] == "Original description"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/dashboard-templates/{template_id}")
    
    def test_update_nonexistent_template(self):
        """PUT /api/dashboard-templates/{id} - Should return 404 for non-existent template"""
        update_response = self.session.put(
            f"{BASE_URL}/api/dashboard-templates/nonexistent_template_id",
            json={"name": "Should Fail"}
        )
        
        assert update_response.status_code == 404, f"Expected 404, got {update_response.status_code}"
    
    def test_update_preset_template_returns_404(self):
        """PUT /api/dashboard-templates/{id} - Should return 404 for preset templates (not owned by user)"""
        update_response = self.session.put(
            f"{BASE_URL}/api/dashboard-templates/preset_sales",
            json={"name": "Should Fail"}
        )
        
        # Preset templates are not owned by user, so should return 404
        assert update_response.status_code == 404, f"Expected 404, got {update_response.status_code}"
    
    def test_update_template_without_auth(self):
        """PUT /api/dashboard-templates/{id} - Should require authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to update without auth
        response = session.put(
            f"{BASE_URL}/api/dashboard-templates/some_template_id",
            json={"name": "Should Fail"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestDashboardTemplatesFromDashboard:
    """Tests for saving dashboards as templates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication and create a test dashboard"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Authenticate
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token") or response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        self.test_dashboard_id = None
        self.test_template_id = None
    
    def teardown_method(self):
        """Cleanup test data after each test"""
        # Delete test template if created
        if hasattr(self, 'test_template_id') and self.test_template_id:
            try:
                self.session.delete(f"{BASE_URL}/api/dashboard-templates/{self.test_template_id}")
            except:
                pass
        
        # Delete test dashboard if created
        if hasattr(self, 'test_dashboard_id') and self.test_dashboard_id:
            try:
                self.session.delete(f"{BASE_URL}/api/dashboards/{self.test_dashboard_id}")
            except:
                pass
    
    def test_save_dashboard_as_template(self):
        """POST /api/dashboard-templates/from-dashboard/{id} - Should save dashboard as template"""
        # First create a test dashboard
        dashboard_data = {
            "name": "TEST_Dashboard For Template",
            "description": "Test dashboard to save as template"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/dashboards", json=dashboard_data)
        
        # Skip if dashboard creation fails (might need org_id)
        if create_response.status_code != 200:
            pytest.skip(f"Dashboard creation failed: {create_response.status_code} - {create_response.text}")
        
        self.test_dashboard_id = create_response.json().get("id")
        assert self.test_dashboard_id, "Dashboard should have an ID"
        
        # Now save it as a template
        template_name = "TEST_Template From Dashboard"
        response = self.session.post(
            f"{BASE_URL}/api/dashboard-templates/from-dashboard/{self.test_dashboard_id}",
            params={"name": template_name}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "message" in data, "Response should contain 'message'"
        assert data["message"] == "Dashboard saved as template"
        
        self.test_template_id = data["id"]
        
        # Verify the template was created correctly
        get_response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        assert get_response.status_code == 200
        
        custom_templates = get_response.json()["custom"]
        created_template = next((t for t in custom_templates if t["id"] == self.test_template_id), None)
        
        assert created_template is not None, "Template should be in custom templates"
        assert created_template["name"] == template_name
        assert created_template["is_preset"] == False
    
    def test_save_nonexistent_dashboard_as_template(self):
        """POST /api/dashboard-templates/from-dashboard/{id} - Should return 404 for non-existent dashboard"""
        response = self.session.post(
            f"{BASE_URL}/api/dashboard-templates/from-dashboard/nonexistent_dashboard_id",
            params={"name": "Should Fail"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPresetTemplateDetails:
    """Test preset template details and widget configurations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_all_preset_templates_have_valid_structure(self):
        """Verify all preset templates have valid widget structure"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates")
        assert response.status_code == 200
        
        preset_templates = response.json()["preset"]
        
        for template in preset_templates:
            # Each template should have widgets array
            assert isinstance(template["widgets"], list), f"Template {template['id']} widgets should be a list"
            
            # Each widget should have required fields
            for widget in template["widgets"]:
                assert "type" in widget, f"Widget in {template['id']} should have 'type'"
                assert "title" in widget, f"Widget in {template['id']} should have 'title'"
                assert "position" in widget, f"Widget in {template['id']} should have 'position'"
                
                # Position should have x, y, w, h
                pos = widget["position"]
                assert "x" in pos and "y" in pos, f"Position should have x and y"
                assert "w" in pos and "h" in pos, f"Position should have w and h"
    
    def test_marketing_template_details(self):
        """Verify Marketing Analytics template details"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates/preset_marketing")
        assert response.status_code == 200
        
        template = response.json()
        assert template["name"] == "Marketing Analytics"
        assert template["icon"] == "Target"
        assert "violet" in template["color"]
        assert len(template["widgets"]) == 9, "Marketing template should have 9 widgets"
    
    def test_operations_template_details(self):
        """Verify Operations Monitor template details"""
        response = self.session.get(f"{BASE_URL}/api/dashboard-templates/preset_operations")
        assert response.status_code == 200
        
        template = response.json()
        assert template["name"] == "Operations Monitor"
        assert template["icon"] == "Activity"
        assert "amber" in template["color"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
