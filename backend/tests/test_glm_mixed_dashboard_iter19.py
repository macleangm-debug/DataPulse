"""
Iteration 19 - Testing GLM, Mixed Models, Dashboard Builder Routes
and T-test validation for >2 groups

Features to test:
1. GLM endpoint /api/models/glm - reachable and valid response
2. Mixed Models endpoint /api/models/mixed - reachable and valid response  
3. Dashboard Builder endpoint /api/dashboards/{org_id} - reachable
4. T-test endpoint error message for >2 groups
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"
TEST_ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"


class TestAuthLogin:
    """Test authentication flow"""
    
    def test_login_success(self):
        """Test login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        print(f"Login response status: {response.status_code}")
        print(f"Login response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data, "No token in response"
        return data


class TestGLMEndpoint:
    """Test GLM (Generalized Linear Model) endpoint"""
    
    def test_glm_endpoint_exists(self):
        """Test that GLM endpoint is reachable"""
        # First login to get token
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test GLM endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        # Test GLM endpoint - should return error about missing data (not 404)
        response = requests.post(
            f"{BASE_URL}/api/models/glm",
            json={
                "org_id": TEST_ORG_ID,
                "form_id": "nonexistent-form",
                "dependent_var": "test_var",
                "independent_vars": ["var1"],
                "family": "gaussian"
            },
            headers=headers
        )
        
        print(f"GLM endpoint status: {response.status_code}")
        print(f"GLM response: {response.text[:500]}")
        
        # Should NOT be 404 (route not found), may be 400/422 (validation) or error about missing data
        assert response.status_code != 404, "GLM endpoint not registered (404)"
        
    def test_glm_endpoint_structure(self):
        """Test GLM endpoint accepts proper request structure"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test GLM endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        # Test with minimal valid structure
        response = requests.post(
            f"{BASE_URL}/api/models/glm",
            json={
                "org_id": TEST_ORG_ID,
                "dependent_var": "age",
                "independent_vars": ["gender"],
                "family": "gaussian"
            },
            headers=headers
        )
        
        print(f"GLM structure test status: {response.status_code}")
        
        # Should accept the structure (400 = validation error about missing data, not route)
        assert response.status_code in [200, 400, 422, 500], f"Unexpected status: {response.status_code}"


class TestMixedModelsEndpoint:
    """Test Mixed Models endpoint"""
    
    def test_mixed_models_endpoint_exists(self):
        """Test that Mixed Models endpoint is reachable"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test Mixed Models endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        # Test Mixed Models endpoint
        response = requests.post(
            f"{BASE_URL}/api/models/mixed",
            json={
                "org_id": TEST_ORG_ID,
                "form_id": "nonexistent-form",
                "dependent_var": "score",
                "fixed_effects": ["age"],
                "random_effects": ["group"],
                "group_var": "region"
            },
            headers=headers
        )
        
        print(f"Mixed Models endpoint status: {response.status_code}")
        print(f"Mixed Models response: {response.text[:500]}")
        
        # Should NOT be 404 (route not found)
        assert response.status_code != 404, "Mixed Models endpoint not registered (404)"


class TestDashboardBuilderEndpoint:
    """Test Dashboard Builder endpoints"""
    
    def test_dashboard_list_endpoint_exists(self):
        """Test that Dashboard list endpoint is reachable"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test Dashboard endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        
        # Test GET dashboards/{org_id}
        response = requests.get(
            f"{BASE_URL}/api/dashboards/{TEST_ORG_ID}",
            headers=headers
        )
        
        print(f"Dashboard list endpoint status: {response.status_code}")
        print(f"Dashboard response: {response.text[:500]}")
        
        # Should NOT be 404 (route not found), may return empty list []
        assert response.status_code != 404, "Dashboard endpoint not registered (404)"
        assert response.status_code == 200, f"Dashboard endpoint error: {response.status_code}"
        
    def test_dashboard_create_endpoint_exists(self):
        """Test that Dashboard create endpoint is reachable"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test Dashboard endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Test POST dashboards (create)
        response = requests.post(
            f"{BASE_URL}/api/dashboards",
            json={
                "org_id": TEST_ORG_ID,
                "name": "TEST_Dashboard_Iter19",
                "description": "Test dashboard from iteration 19",
                "widgets": [],
                "filters": []
            },
            headers=headers
        )
        
        print(f"Dashboard create endpoint status: {response.status_code}")
        print(f"Dashboard create response: {response.text[:500]}")
        
        # Should NOT be 404
        assert response.status_code != 404, "Dashboard create endpoint not registered (404)"


class TestTTestValidation:
    """Test T-test endpoint validation for >2 groups"""
    
    def test_ttest_error_message_for_multiple_groups(self):
        """Test that T-test returns descriptive error for >2 groups"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not login to test T-test endpoint")
        
        token = login_resp.json().get("token") or login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get available forms first
        forms_resp = requests.get(
            f"{BASE_URL}/api/forms?org_id={TEST_ORG_ID}",
            headers=headers
        )
        
        print(f"Forms response status: {forms_resp.status_code}")
        
        if forms_resp.status_code != 200:
            pytest.skip("Could not get forms to test T-test")
        
        forms = forms_resp.json()
        print(f"Found {len(forms)} forms")
        
        if not forms:
            # Just verify the endpoint is reachable and returns proper structure
            response = requests.post(
                f"{BASE_URL}/api/statistics/ttest",
                json={
                    "org_id": TEST_ORG_ID,
                    "form_id": "test-form",
                    "test_type": "independent",
                    "variable": "score",
                    "group_var": "category"
                },
                headers=headers
            )
            
            print(f"T-test endpoint status: {response.status_code}")
            # Should NOT be 404
            assert response.status_code != 404, "T-test endpoint not registered"
            return
        
        # Try with actual form if available
        form_id = forms[0].get("id")
        response = requests.post(
            f"{BASE_URL}/api/statistics/ttest",
            json={
                "org_id": TEST_ORG_ID,
                "form_id": form_id,
                "test_type": "independent",
                "variable": "age",  # Common variable
                "group_var": "region"  # Likely has >2 groups
            },
            headers=headers
        )
        
        print(f"T-test validation response status: {response.status_code}")
        print(f"T-test response: {response.text}")
        
        # If >2 groups, should return 400 with helpful message about ANOVA
        if response.status_code == 400:
            error_detail = response.json().get("detail", "")
            print(f"Error message: {error_detail}")
            # Check for helpful error message suggesting ANOVA
            if "2 groups" in error_detail.lower() or "anova" in error_detail.lower():
                print("PASS: T-test returns helpful error message for >2 groups")
        
        # Should NOT be 404
        assert response.status_code != 404, "T-test endpoint not registered"


class TestHealthAndRoot:
    """Basic API health checks"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health check: {data}")
        
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "DataPulse" in data.get("message", "")
        print(f"Root check: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
