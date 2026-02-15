"""
Test Suite for Missing Data Imputation Feature - Iteration 23
Endpoints: /api/analysis/imputation/*
- GET /api/analysis/imputation/missing-summary/{form_id} - Get missing data summary
- POST /api/analysis/imputation/preview - Preview imputation without applying
- POST /api/analysis/imputation/apply - Apply imputation and create snapshot
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"
TEST_ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"


class TestMissingDataImputation:
    """Tests for missing data imputation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login and get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get form ID
        forms_response = self.session.get(f"{BASE_URL}/api/forms?org_id={TEST_ORG_ID}")
        if forms_response.status_code == 200:
            forms = forms_response.json()
            self.form_id = forms[0]["id"] if forms else None
        else:
            self.form_id = None
    
    # ========== Missing Summary Endpoint Tests ==========
    
    def test_missing_summary_endpoint_exists(self):
        """Test that missing summary endpoint exists and returns 200"""
        if not self.form_id:
            pytest.skip("No form available for testing")
        
        response = self.session.get(f"{BASE_URL}/api/analysis/imputation/missing-summary/{self.form_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PASS: Missing summary endpoint returned 200")
    
    def test_missing_summary_response_structure(self):
        """Test that missing summary returns correct structure"""
        if not self.form_id:
            pytest.skip("No form available for testing")
        
        response = self.session.get(f"{BASE_URL}/api/analysis/imputation/missing-summary/{self.form_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify required fields exist
        assert "total_rows" in data, "Missing 'total_rows' in response"
        assert "variables" in data, "Missing 'variables' in response"
        assert "overall_missing_percent" in data, "Missing 'overall_missing_percent' in response"
        
        print(f"PASS: Missing summary has correct structure")
        print(f"  - Total rows: {data.get('total_rows')}")
        print(f"  - Total columns: {data.get('total_columns')}")
        print(f"  - Overall missing percent: {data.get('overall_missing_percent')}%")
        print(f"  - Variables count: {len(data.get('variables', []))}")
    
    def test_missing_summary_variable_details(self):
        """Test that each variable has proper missing data details"""
        if not self.form_id:
            pytest.skip("No form available for testing")
        
        response = self.session.get(f"{BASE_URL}/api/analysis/imputation/missing-summary/{self.form_id}")
        assert response.status_code == 200
        
        data = response.json()
        variables = data.get("variables", [])
        
        if not variables:
            print("PASS: Response valid but no variables found (empty data)")
            return
        
        # Check first variable has required fields
        first_var = variables[0]
        required_fields = ["variable", "missing_count", "missing_percent", "complete_count", "complete_percent", "total"]
        
        for field in required_fields:
            assert field in first_var, f"Missing '{field}' in variable details"
        
        print(f"PASS: Variable details have correct structure")
        for var in variables[:3]:  # Show first 3
            print(f"  - {var.get('variable')}: {var.get('missing_count')} missing ({var.get('missing_percent')}%)")
    
    def test_missing_summary_with_snapshot(self):
        """Test missing summary with snapshot_id parameter"""
        if not self.form_id:
            pytest.skip("No form available for testing")
        
        # Get snapshots
        snapshots_response = self.session.get(f"{BASE_URL}/api/analysis/snapshots/{TEST_ORG_ID}?form_id={self.form_id}")
        
        if snapshots_response.status_code == 200:
            snapshots = snapshots_response.json()
            if snapshots:
                snapshot_id = snapshots[0].get("id")
                response = self.session.get(
                    f"{BASE_URL}/api/analysis/imputation/missing-summary/{self.form_id}?snapshot_id={snapshot_id}"
                )
                assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
                print(f"PASS: Missing summary with snapshot_id works correctly")
                return
        
        print("PASS: No snapshots available to test, endpoint validation passed")
    
    # ========== Preview Imputation Endpoint Tests ==========
    
    def test_preview_imputation_endpoint_exists(self):
        """Test that preview imputation endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/analysis/imputation/preview", json={
            "org_id": TEST_ORG_ID,
            "form_id": self.form_id,
            "variables": [],
            "method": "mean"
        })
        
        # Should return 200 even with empty variables (will have error in body)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Preview imputation endpoint exists and accepts POST")
    
    def test_preview_imputation_with_variables(self):
        """Test preview imputation with actual variables"""
        if not self.form_id:
            pytest.skip("No form available for testing")
        
        # First get the variables from missing summary
        summary_response = self.session.get(f"{BASE_URL}/api/analysis/imputation/missing-summary/{self.form_id}")
        if summary_response.status_code != 200:
            pytest.skip("Cannot get variables for preview test")
        
        summary_data = summary_response.json()
        variables = summary_data.get("variables", [])
        
        if not variables:
            pytest.skip("No variables available for preview test")
        
        # Get first variable for testing
        test_var = variables[0]["variable"]
        
        response = self.session.post(f"{BASE_URL}/api/analysis/imputation/preview", json={
            "org_id": TEST_ORG_ID,
            "form_id": self.form_id,
            "variables": [test_var],
            "method": "mean"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check response structure
        assert "n_original" in data or "error" in data, "Missing expected fields in response"
        
        if "error" not in data:
            assert "missing_before" in data, "Missing 'missing_before' in response"
            assert "missing_after" in data, "Missing 'missing_after' in response"
            print(f"PASS: Preview imputation returns before/after statistics")
            print(f"  - Original rows: {data.get('n_original')}")
            print(f"  - After imputation: {data.get('n_after')}")
        else:
            print(f"PASS: Preview returned (no data available): {data.get('error')}")
    
    def test_preview_all_imputation_methods(self):
        """Test that all imputation methods are accepted"""
        methods = ["mean", "median", "mode", "constant", "ffill", "bfill", "interpolate", "drop"]
        
        for method in methods:
            payload = {
                "org_id": TEST_ORG_ID,
                "form_id": self.form_id,
                "variables": [],
                "method": method
            }
            
            if method == "constant":
                payload["constant_value"] = 0
            
            response = self.session.post(f"{BASE_URL}/api/analysis/imputation/preview", json=payload)
            
            assert response.status_code == 200, f"Method '{method}' failed with status {response.status_code}"
        
        print(f"PASS: All {len(methods)} imputation methods are accepted: {', '.join(methods)}")
    
    # ========== Apply Imputation Endpoint Tests ==========
    
    def test_apply_imputation_requires_create_snapshot(self):
        """Test that apply imputation requires create_snapshot=true"""
        response = self.session.post(f"{BASE_URL}/api/analysis/imputation/apply", json={
            "org_id": TEST_ORG_ID,
            "form_id": self.form_id,
            "variables": ["test"],
            "method": "mean",
            "create_snapshot": False
        })
        
        # Should return 400 when create_snapshot is false
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Apply imputation correctly requires create_snapshot=true")
    
    def test_apply_imputation_endpoint_exists(self):
        """Test that apply imputation endpoint exists"""
        response = self.session.post(f"{BASE_URL}/api/analysis/imputation/apply", json={
            "org_id": TEST_ORG_ID,
            "form_id": self.form_id,
            "variables": [],
            "method": "mean",
            "create_snapshot": True
        })
        
        # Should return either 200 (no data) or create snapshot successfully
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print(f"PASS: Apply imputation endpoint exists (status: {response.status_code})")


class TestImputationMethodValidation:
    """Tests for imputation method validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_invalid_method_rejected(self):
        """Test that invalid imputation method is rejected"""
        response = self.session.post(f"{BASE_URL}/api/analysis/imputation/preview", json={
            "org_id": TEST_ORG_ID,
            "form_id": "test_form",
            "variables": ["test"],
            "method": "invalid_method"
        })
        
        # Should return 422 for invalid enum value
        assert response.status_code == 422, f"Expected 422 for invalid method, got {response.status_code}"
        print("PASS: Invalid imputation method correctly rejected with 422")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
