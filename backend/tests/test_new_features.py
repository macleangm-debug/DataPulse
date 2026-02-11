"""
Backend tests for DataPulse new features:
1. Audio Audit System
2. Form Groups/Folders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://agitated-diffie.preview.emergentagent.com')


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@datapulse.io", "password": "Test123!"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def org_id(self, auth_token):
        """Get organization ID"""
        response = requests.get(
            f"{BASE_URL}/api/organizations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get orgs failed: {response.text}"
        orgs = response.json()
        assert len(orgs) > 0, "No organizations found"
        return orgs[0]["id"]
    
    def test_login(self, auth_token):
        """Test login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0


class TestAudioAuditAPI:
    """Audio Audit API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@datapulse.io", "password": "Test123!"}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def org_id(self, auth_token):
        """Get organization ID"""
        response = requests.get(
            f"{BASE_URL}/api/organizations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        orgs = response.json()
        return orgs[0]["id"]
    
    def test_get_audio_stats(self, auth_token, org_id):
        """Test getting audio audit stats"""
        response = requests.get(
            f"{BASE_URL}/api/audio-audit/stats?org_id={org_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify stats structure
        assert "total_recordings" in data
        assert "total_duration_hours" in data
        assert "pending_count" in data
        assert "flagged_count" in data
        assert isinstance(data["total_recordings"], int)
        assert isinstance(data["total_duration_hours"], float)
    
    def test_get_recordings_list(self, auth_token):
        """Test getting recordings list"""
        response = requests.get(
            f"{BASE_URL}/api/audio-audit/recordings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "recordings" in data
        assert "total" in data
        assert isinstance(data["recordings"], list)
    
    def test_get_recordings_with_filters(self, auth_token):
        """Test getting recordings with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/audio-audit/recordings?status=pending",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "recordings" in data
    
    def test_get_audio_config_default(self, auth_token):
        """Test getting default audio config"""
        response = requests.get(
            f"{BASE_URL}/api/audio-audit/config/test-form-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return default config
        assert "config" in data
        assert data["config"]["enabled"] == False  # Default is disabled


class TestFormGroupsAPI:
    """Form Groups/Folders API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@datapulse.io", "password": "Test123!"}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def org_id(self, auth_token):
        """Get organization ID"""
        response = requests.get(
            f"{BASE_URL}/api/organizations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        orgs = response.json()
        return orgs[0]["id"]
    
    created_group_id = None
    
    def test_get_form_groups_tree(self, auth_token, org_id):
        """Test getting form groups tree structure"""
        response = requests.get(
            f"{BASE_URL}/api/form-groups/tree?org_id={org_id}&include_forms=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify tree structure
        assert "tree" in data
        assert "ungrouped_forms" in data
        assert "total_groups" in data
        assert "total_forms" in data
        assert isinstance(data["tree"], list)
        assert isinstance(data["ungrouped_forms"], list)
    
    def test_list_form_groups(self, auth_token, org_id):
        """Test listing form groups"""
        response = requests.get(
            f"{BASE_URL}/api/form-groups?org_id={org_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "groups" in data
        assert isinstance(data["groups"], list)
    
    def test_create_form_group(self, auth_token, org_id):
        """Test creating a new form group"""
        response = requests.post(
            f"{BASE_URL}/api/form-groups?org_id={org_id}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Test Folder",
                "description": "Test folder for API testing",
                "color": "#3b82f6"
            }
        )
        assert response.status_code == 201, f"Failed: {response.text}"
        data = response.json()
        
        # Store for later tests
        TestFormGroupsAPI.created_group_id = data["id"]
        
        # Verify response structure
        assert data["name"] == "TEST_Test Folder"
        assert data["description"] == "Test folder for API testing"
        assert data["color"] == "#3b82f6"
        assert "id" in data
        assert data["form_count"] == 0
    
    def test_get_form_group(self, auth_token, org_id):
        """Test getting a specific form group"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No group created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}?include_forms=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "group" in data
        assert "children" in data
        assert "forms" in data
        assert "breadcrumb" in data
        assert data["group"]["name"] == "TEST_Test Folder"
    
    def test_update_form_group(self, auth_token, org_id):
        """Test updating a form group"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No group created in previous test")
        
        response = requests.put(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Updated Folder",
                "color": "#22c55e"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        
        # Verify update
        response = requests.get(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["group"]["name"] == "TEST_Updated Folder"
        assert data["group"]["color"] == "#22c55e"
    
    def test_create_nested_folder(self, auth_token, org_id):
        """Test creating a nested folder"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No parent group created")
        
        response = requests.post(
            f"{BASE_URL}/api/form-groups?org_id={org_id}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "name": "TEST_Nested Folder",
                "parent_id": TestFormGroupsAPI.created_group_id,
                "color": "#f97316"
            }
        )
        assert response.status_code == 201, f"Failed: {response.text}"
        data = response.json()
        
        assert data["parent_id"] == TestFormGroupsAPI.created_group_id
        
        # Clean up nested folder
        requests.delete(
            f"{BASE_URL}/api/form-groups/{data['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_archive_form_group(self, auth_token, org_id):
        """Test archiving a form group"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No group created")
        
        response = requests.post(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}/archive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        
        # Verify archived - should not appear in list
        response = requests.get(
            f"{BASE_URL}/api/form-groups?org_id={org_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        groups = response.json()["groups"]
        archived_ids = [g["id"] for g in groups]
        assert TestFormGroupsAPI.created_group_id not in archived_ids
    
    def test_unarchive_form_group(self, auth_token, org_id):
        """Test unarchiving a form group"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No group created")
        
        response = requests.post(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}/unarchive",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
    
    def test_delete_form_group(self, auth_token, org_id):
        """Test deleting a form group"""
        if not TestFormGroupsAPI.created_group_id:
            pytest.skip("No group created")
        
        response = requests.delete(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        
        # Verify deleted
        response = requests.get(
            f"{BASE_URL}/api/form-groups/{TestFormGroupsAPI.created_group_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


class TestFormBuilderValidation:
    """Test form builder validation endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@datapulse.io", "password": "Test123!"}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    def test_get_form_for_validation(self, auth_token):
        """Test getting form to verify field validation structure"""
        form_id = "679a763e-f27e-4b79-aa56-8d564e32381c"  # Test form ID
        
        response = requests.get(
            f"{BASE_URL}/api/forms/{form_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify form structure supports validation
        assert "fields" in data or "id" in data
        # Form should have id and name at minimum
        assert data.get("id") == form_id


class TestBulkFormOperations:
    """Test bulk form operations for form groups"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "demo@datapulse.io", "password": "Test123!"}
        )
        assert response.status_code == 200
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def org_id(self, auth_token):
        """Get organization ID"""
        response = requests.get(
            f"{BASE_URL}/api/organizations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        orgs = response.json()
        return orgs[0]["id"]
    
    def test_bulk_move_forms_to_ungrouped(self, auth_token, org_id):
        """Test bulk moving forms to ungrouped (no folder)"""
        # This tests the bulk move endpoint even with empty form list
        response = requests.post(
            f"{BASE_URL}/api/form-groups/move-forms-bulk",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "form_ids": [],
                "target_group_id": None
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["moved_count"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
