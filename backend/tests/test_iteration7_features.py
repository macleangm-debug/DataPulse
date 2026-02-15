"""
Test DataPulse Iteration 7 Features:
- Dashboard Widgets API (widget types, layouts)
- Export Formats API (CSV, JSON, XLSX, Stata, SPSS)
- Case Import API (template, preview, import)
- Collaboration WebSocket routes (room users, user presence)

Tests for: Widget routes, Export routes, Case import routes, Collaboration routes
"""

import pytest
import requests
import os
import json

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

TEST_CREDENTIALS = {
    "email": "test@datapulse.io",
    "password": "password123"
}


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "DataPulse" in data["message"]
        print("✓ API root endpoint working")
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"✓ Health check: {data.get('status')}")


class TestWidgetRoutes:
    """Dashboard Widgets API Tests"""
    
    def test_get_widget_types(self):
        """Test GET /api/dashboard/widgets/widget-types returns 8 widget types"""
        response = requests.get(f"{BASE_URL}/api/dashboard/widgets/widget-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "widget_types" in data, "Response should have 'widget_types' key"
        
        widget_types = data["widget_types"]
        assert len(widget_types) == 8, f"Expected 8 widget types, got {len(widget_types)}"
        
        # Verify expected widget type IDs
        expected_types = ["stat_card", "line_chart", "bar_chart", "pie_chart", 
                        "table", "map", "activity_feed", "progress"]
        actual_types = [wt["id"] for wt in widget_types]
        
        for expected in expected_types:
            assert expected in actual_types, f"Missing widget type: {expected}"
        
        # Verify each widget type has required fields
        for wt in widget_types:
            assert "id" in wt, "Widget type should have 'id'"
            assert "name" in wt, "Widget type should have 'name'"
            assert "description" in wt, "Widget type should have 'description'"
            assert "config_schema" in wt, "Widget type should have 'config_schema'"
        
        print(f"✓ Widget types endpoint returns {len(widget_types)} types: {actual_types}")
    
    def test_get_dashboard_layouts(self):
        """Test GET /api/dashboard/widgets/layouts/{org_id} returns default layout with 8 widgets"""
        test_org_id = "test-org-123"
        response = requests.get(f"{BASE_URL}/api/dashboard/widgets/layouts/{test_org_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "layouts" in data, "Response should have 'layouts' key"
        
        layouts = data["layouts"]
        assert len(layouts) >= 1, "Should have at least one layout"
        
        # Check default layout
        default_layout = layouts[0]
        assert "widgets" in default_layout, "Layout should have 'widgets'"
        
        widgets = default_layout["widgets"]
        assert len(widgets) == 8, f"Expected 8 widgets in default layout, got {len(widgets)}"
        
        # Verify widget structure
        for widget in widgets:
            assert "id" in widget, "Widget should have 'id'"
            assert "widget_type" in widget, "Widget should have 'widget_type'"
            assert "title" in widget, "Widget should have 'title'"
            assert "config" in widget, "Widget should have 'config'"
            assert "position" in widget, "Widget should have 'position'"
        
        widget_types = [w["widget_type"] for w in widgets]
        print(f"✓ Dashboard layout has {len(widgets)} widgets: {widget_types}")


class TestExportFormats:
    """Export Formats API Tests"""
    
    def test_get_export_formats(self):
        """Test GET /api/exports/formats returns 5 formats including Stata and SPSS"""
        response = requests.get(f"{BASE_URL}/api/exports/formats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "formats" in data, "Response should have 'formats' key"
        
        formats = data["formats"]
        assert len(formats) == 5, f"Expected 5 formats, got {len(formats)}"
        
        # Verify expected format IDs
        expected_formats = ["csv", "xlsx", "json", "stata", "spss"]
        actual_formats = [f["id"] for f in formats]
        
        for expected in expected_formats:
            assert expected in actual_formats, f"Missing format: {expected}"
        
        # Verify each format has required fields
        for fmt in formats:
            assert "id" in fmt, "Format should have 'id'"
            assert "name" in fmt, "Format should have 'name'"
            assert "extension" in fmt, "Format should have 'extension'"
            assert "description" in fmt, "Format should have 'description'"
        
        # Verify Stata and SPSS details
        stata_format = next(f for f in formats if f["id"] == "stata")
        assert stata_format["extension"] == ".do", "Stata extension should be .do"
        
        spss_format = next(f for f in formats if f["id"] == "spss")
        assert spss_format["extension"] == ".sps", "SPSS extension should be .sps"
        
        print(f"✓ Export formats endpoint returns {len(formats)} formats: {actual_formats}")


class TestCaseImportRoutes:
    """Case Import API Tests"""
    
    def test_get_import_template(self):
        """Test GET /api/cases/import/template returns CSV template and instructions"""
        response = requests.get(f"{BASE_URL}/api/cases/import/template")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "template" in data, "Response should have 'template' key"
        assert "instructions" in data, "Response should have 'instructions' key"
        
        # Verify template content
        template = data["template"]
        assert "case_id" in template, "Template should contain case_id column"
        assert "subject_id" in template, "Template should contain subject_id column"
        assert "subject_name" in template, "Template should contain subject_name column"
        assert "status" in template, "Template should contain status column"
        
        # Verify instructions
        instructions = data["instructions"]
        assert "required_fields" in instructions, "Instructions should have required_fields"
        assert "optional_fields" in instructions, "Instructions should have optional_fields"
        assert "status_values" in instructions, "Instructions should have status_values"
        assert "priority_values" in instructions, "Instructions should have priority_values"
        assert "notes" in instructions, "Instructions should have notes"
        
        print("✓ Case import template endpoint returns template and instructions")
        print(f"  - Required fields: {instructions.get('required_fields')}")
        print(f"  - Status values: {instructions.get('status_values')}")


class TestCollaborationRoutes:
    """Collaboration Routes Tests (non-WebSocket endpoints)"""
    
    def test_get_room_users(self):
        """Test GET /api/collaboration/rooms/{room_type}/{room_id}/users"""
        response = requests.get(f"{BASE_URL}/api/collaboration/rooms/form/test-form-123/users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "users" in data, "Response should have 'users' key"
        assert "count" in data, "Response should have 'count' key"
        assert isinstance(data["users"], list), "Users should be a list"
        assert isinstance(data["count"], int), "Count should be an integer"
        
        print(f"✓ Collaboration room users endpoint working (count: {data['count']})")
    
    def test_get_user_presence(self):
        """Test GET /api/collaboration/presence/{user_id}"""
        response = requests.get(f"{BASE_URL}/api/collaboration/presence/test-user-123")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "active_rooms" in data, "Response should have 'active_rooms' key"
        assert isinstance(data["active_rooms"], list), "active_rooms should be a list"
        
        print(f"✓ Collaboration user presence endpoint working")


class TestAuthenticatedEndpoints:
    """Tests that require authentication"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.headers = {"Authorization": f"Bearer {self.token}"}
            print(f"✓ Authenticated as {self.user.get('email')}")
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_case_import_preview_requires_auth(self):
        """Test that case import preview requires authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/cases/import/preview")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Case import preview requires authentication")
    
    def test_case_import_requires_auth(self):
        """Test that case import requires authentication"""
        # Without auth
        response = requests.post(f"{BASE_URL}/api/cases/import")
        assert response.status_code in [401, 403, 422], "Should require authentication"
        print("✓ Case import requires authentication")
    
    def test_export_history_with_auth(self):
        """Test export history endpoint with authentication"""
        test_org_id = "org-test-123"
        response = requests.get(
            f"{BASE_URL}/api/exports/history?org_id={test_org_id}",
            headers=self.headers
        )
        # Should return 200, 401, or 403 (if no access to org)
        assert response.status_code in [200, 401, 403], f"Expected 200, 401 or 403, got {response.status_code}"
        print(f"✓ Export history endpoint responds correctly (status: {response.status_code})")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
