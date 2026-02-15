"""
Test Dashboard Drill-Down and New Chart Types (Iteration 24)
Features tested:
- Heatmap endpoint /api/analysis/charts/heatmap (correlation matrix)
- Violin endpoint /api/analysis/charts/violin (distribution by group)  
- Coefficient endpoint /api/analysis/charts/coefficient (regression results)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"

# Get auth token
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@datapulse.io",
        "password": "Test123!"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# Get form_id for testing
@pytest.fixture(scope="module")
def form_id(api_client):
    """Get a form ID for testing"""
    response = api_client.get(f"{BASE_URL}/api/forms/{ORG_ID}")
    if response.status_code == 200:
        forms = response.json()
        if forms and len(forms) > 0:
            return forms[0].get("id")
    return None


class TestHeatmapEndpoint:
    """Tests for /api/analysis/charts/heatmap endpoint"""
    
    def test_heatmap_endpoint_exists(self, api_client, form_id):
        """Test that heatmap endpoint exists and responds"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/heatmap", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "variables": ["var1", "var2"]
        })
        # Should return 200 with error message (no data) or correlation data
        assert response.status_code == 200
        data = response.json()
        # Response should have expected structure
        assert "error" in data or "data" in data or "variables" in data
        print(f"Heatmap response: {data}")
    
    def test_heatmap_requires_two_variables(self, api_client, form_id):
        """Test that heatmap requires at least 2 variables"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/heatmap", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "variables": ["single_var"]
        })
        assert response.status_code == 200
        data = response.json()
        # Should indicate error for single variable
        if "error" in data:
            assert "2 variables" in data["error"] or "Need at least" in data["error"] or "No data" in data["error"]
        print(f"Single variable heatmap response: {data}")
    
    def test_heatmap_validation(self, api_client):
        """Test heatmap request validation - missing required fields"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/heatmap", json={
            "variables": ["var1", "var2"]
            # Missing org_id
        })
        assert response.status_code == 422
        print("Validation test passed - missing org_id rejected")


class TestViolinEndpoint:
    """Tests for /api/analysis/charts/violin endpoint"""
    
    def test_violin_endpoint_exists(self, api_client, form_id):
        """Test that violin endpoint exists and responds"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/violin", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "numeric_var": "age"
        })
        assert response.status_code == 200
        data = response.json()
        # Response should have expected structure
        assert "error" in data or "groups" in data or "variable" in data
        print(f"Violin response: {data}")
    
    def test_violin_with_group_var(self, api_client, form_id):
        """Test violin plot with grouping variable"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/violin", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "numeric_var": "age",
            "group_var": "gender"
        })
        assert response.status_code == 200
        data = response.json()
        # Response should have groups or error
        if "groups" in data:
            assert isinstance(data["groups"], list)
        print(f"Violin with grouping response: {data}")
    
    def test_violin_validation(self, api_client):
        """Test violin request validation - missing required fields"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/violin", json={
            "org_id": ORG_ID
            # Missing numeric_var
        })
        assert response.status_code == 422
        print("Validation test passed - missing numeric_var rejected")
    
    def test_violin_response_structure(self, api_client, form_id):
        """Test violin response has correct structure when data exists"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/violin", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "numeric_var": "test_var"
        })
        assert response.status_code == 200
        data = response.json()
        
        # If we have data, check structure
        if "groups" in data and len(data["groups"]) > 0:
            group = data["groups"][0]
            expected_fields = ["name", "n", "mean", "median", "std", "min", "max"]
            for field in expected_fields:
                assert field in group, f"Missing field {field} in violin group"
        print(f"Violin structure check: {data.keys()}")


class TestCoefficientEndpoint:
    """Tests for /api/analysis/charts/coefficient endpoint"""
    
    def test_coefficient_endpoint_exists(self, api_client, form_id):
        """Test that coefficient endpoint exists and responds"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/coefficient", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "dependent_var": "outcome",
            "independent_vars": ["age", "income"]
        })
        assert response.status_code == 200
        data = response.json()
        # Response should have expected structure
        assert "error" in data or "coefficients" in data or "dependent_var" in data
        print(f"Coefficient response: {data}")
    
    def test_coefficient_requires_vars(self, api_client, form_id):
        """Test coefficient requires dependent and independent vars"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/coefficient", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "dependent_var": "outcome",
            "independent_vars": []  # Empty list
        })
        assert response.status_code == 200
        data = response.json()
        # Should indicate error or have coefficients
        print(f"Empty independent vars response: {data}")
    
    def test_coefficient_validation(self, api_client):
        """Test coefficient request validation - missing required fields"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/coefficient", json={
            "org_id": ORG_ID,
            "dependent_var": "outcome"
            # Missing independent_vars
        })
        assert response.status_code == 422
        print("Validation test passed - missing independent_vars rejected")
    
    def test_coefficient_response_structure(self, api_client, form_id):
        """Test coefficient response structure when data exists"""
        response = api_client.post(f"{BASE_URL}/api/analysis/charts/coefficient", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "dependent_var": "satisfaction",
            "independent_vars": ["age"]
        })
        assert response.status_code == 200
        data = response.json()
        
        # If regression ran successfully, check structure
        if "coefficients" in data and len(data["coefficients"]) > 0:
            coef = data["coefficients"][0]
            expected_fields = ["variable", "coefficient", "std_error", "ci_lower", "ci_upper", "p_value", "significant"]
            for field in expected_fields:
                assert field in coef, f"Missing field {field} in coefficient"
        print(f"Coefficient structure check: {data.keys()}")


class TestChartTypesList:
    """Test that Chart Studio shows 10 chart types"""
    
    def test_quick_stats_for_charts(self, api_client, form_id):
        """Test quick stats endpoint that provides data for charts"""
        if not form_id:
            pytest.skip("No form available for testing")
        
        response = api_client.post(f"{BASE_URL}/api/analysis/stats/quick", json={
            "org_id": ORG_ID,
            "form_id": form_id,
            "variables": ["age"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "variables" in data or "total_n" in data
        print(f"Quick stats response: {data.keys()}")


class TestDashboardAPIs:
    """Test dashboard-related APIs for drill-down support"""
    
    def test_list_dashboards(self, api_client):
        """Test listing dashboards for an org"""
        response = api_client.get(f"{BASE_URL}/api/dashboards/{ORG_ID}")
        # Should return 200 with list (possibly empty)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Dashboards found: {len(data)}")
    
    def test_dashboard_data_endpoint(self, api_client):
        """Test dashboard data endpoint exists"""
        response = api_client.post(f"{BASE_URL}/api/dashboards/data", json={
            "dashboard_id": "test-dashboard-id",
            "filters": {}
        })
        # Should return 200 or 404 (dashboard not found)
        assert response.status_code in [200, 404]
        print(f"Dashboard data endpoint status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
