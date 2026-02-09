"""
Factor Analysis Endpoint Tests - Iteration 22
Tests for /api/statistics/factor-analysis endpoint

Features tested:
- Factor Analysis returns valid response structure
- KMO measure and interpretation
- Bartlett's test with chi-square, df, p-value
- Scree plot data (eigenvalues)
- Loading matrix with communalities
- Factor interpretation with high loading variables
- Error handling for insufficient data
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

@pytest.fixture(scope='module')
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@datapulse.io",
        "password": "Test123!"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")

@pytest.fixture(scope='module')
def auth_headers(auth_token):
    """Auth headers fixture"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }

@pytest.fixture(scope='module')
def org_id():
    """Organization ID for testing"""
    return "a07e901a-bd5f-450d-8533-ed4f7ec629a5"

@pytest.fixture(scope='module')
def test_form_data(auth_headers, org_id):
    """Get a form with numeric fields for testing"""
    # First, get available forms
    response = requests.get(
        f"{BASE_URL}/api/forms/org/{org_id}",
        headers=auth_headers
    )
    if response.status_code != 200:
        pytest.skip("Could not get forms list")
    
    forms = response.json()
    if not forms:
        pytest.skip("No forms available")
    
    # Try to find a form with numeric fields
    for form in forms:
        form_id = form.get("id")
        # Get form details
        form_response = requests.get(
            f"{BASE_URL}/api/forms/{form_id}",
            headers=auth_headers
        )
        if form_response.status_code == 200:
            form_data = form_response.json()
            fields = form_data.get("fields", [])
            numeric_fields = [f for f in fields if f.get("type") in ["number", "integer", "decimal"]]
            if len(numeric_fields) >= 3:
                return {
                    "form_id": form_id,
                    "numeric_fields": [f["id"] for f in numeric_fields],
                    "form_data": form_data
                }
    
    return None


class TestFactorAnalysisEndpoint:
    """Test Factor Analysis API endpoint"""

    def test_factor_analysis_endpoint_exists(self, auth_headers, org_id):
        """Test that factor analysis endpoint exists and accepts POST"""
        # Send a minimal request to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "org_id": org_id,
                "variables": ["var1", "var2", "var3"]
            }
        )
        # Should not be 404 (endpoint not found) or 405 (method not allowed)
        assert response.status_code != 404, "Factor analysis endpoint does not exist"
        assert response.status_code != 405, "Factor analysis endpoint does not accept POST"
        print(f"Factor analysis endpoint exists, status: {response.status_code}")

    def test_factor_analysis_requires_three_variables(self, auth_headers, org_id):
        """Test that factor analysis handles < 3 variables case"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "org_id": org_id,
                "variables": ["var1", "var2"],
                "rotation": "varimax"
            }
        )
        # Endpoint may return 200 with error in body or 400 status
        # Check for either an HTTP error or an error message in response
        data = response.json()
        if response.status_code == 400:
            # 400 is expected for validation error
            print(f"Returns 400 for < 3 variables: {data}")
        elif response.status_code == 200:
            # 200 with error message in body is also valid (when no data available)
            assert "error" in data or "detail" in data, f"Response should have error: {data}"
            print(f"Returns 200 with error for < 3 variables: {data}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")

    def test_factor_analysis_with_form_data(self, auth_headers, org_id, test_form_data):
        """Test factor analysis with actual form data"""
        if not test_form_data:
            pytest.skip("No form with 3+ numeric fields available")
        
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "form_id": test_form_data["form_id"],
                "org_id": org_id,
                "variables": test_form_data["numeric_fields"][:5],  # Use up to 5 variables
                "rotation": "varimax"
            }
        )
        print(f"Factor analysis response status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)[:1000]}")
        
        # If insufficient data (< 50 observations), should return error message
        if response.status_code == 200:
            data = response.json()
            if "error" in data:
                # Expected if data < 50 observations
                print(f"Factor analysis returned error: {data['error']}")
                assert "50" in data["error"] or "complete cases" in data["error"].lower() or "insufficient" in data["error"].lower(), \
                    f"Error should mention data requirement: {data['error']}"
            else:
                # Success - validate response structure
                self._validate_factor_analysis_response(data)

    def test_factor_analysis_response_structure_with_mock_variables(self, auth_headers, org_id):
        """Test factor analysis response with variables that may not exist (structure test)"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "org_id": org_id,
                "variables": ["q1", "q2", "q3", "q4", "q5"],
                "n_factors": 2,
                "rotation": "varimax"
            }
        )
        # Just check it doesn't crash - response depends on data availability
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"
        print(f"Response with mock variables: {response.status_code}")

    def test_factor_analysis_rotation_options(self, auth_headers, org_id, test_form_data):
        """Test factor analysis with different rotation methods"""
        if not test_form_data:
            pytest.skip("No form with numeric fields available")
        
        for rotation in ["varimax", "none"]:
            response = requests.post(
                f"{BASE_URL}/api/statistics/factor-analysis",
                headers=auth_headers,
                json={
                    "form_id": test_form_data["form_id"],
                    "org_id": org_id,
                    "variables": test_form_data["numeric_fields"][:4],
                    "rotation": rotation
                }
            )
            assert response.status_code in [200, 400], f"Rotation '{rotation}' failed with status {response.status_code}"
            data = response.json()
            if "error" not in data and response.status_code == 200:
                assert data.get("rotation") == rotation, f"Rotation should be '{rotation}'"
            print(f"Rotation '{rotation}': status {response.status_code}")

    def test_factor_analysis_n_factors_parameter(self, auth_headers, org_id, test_form_data):
        """Test factor analysis with explicit number of factors"""
        if not test_form_data:
            pytest.skip("No form with numeric fields available")
        
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "form_id": test_form_data["form_id"],
                "org_id": org_id,
                "variables": test_form_data["numeric_fields"][:5],
                "n_factors": 2,
                "rotation": "varimax"
            }
        )
        if response.status_code == 200:
            data = response.json()
            if "error" not in data:
                assert data.get("n_factors") == 2, f"Should extract 2 factors, got {data.get('n_factors')}"
                print(f"N_factors parameter respected: {data.get('n_factors')} factors")

    def _validate_factor_analysis_response(self, data):
        """Helper to validate factor analysis response structure"""
        # Check KMO
        assert "kmo" in data, "Response should contain KMO"
        assert "value" in data["kmo"], "KMO should have value"
        assert "interpretation" in data["kmo"], "KMO should have interpretation"
        assert 0 <= data["kmo"]["value"] <= 1, f"KMO should be 0-1, got {data['kmo']['value']}"
        print(f"KMO: {data['kmo']['value']} ({data['kmo']['interpretation']})")
        
        # Check Bartlett's test
        assert "bartlett_test" in data, "Response should contain Bartlett test"
        bartlett = data["bartlett_test"]
        assert "chi_square" in bartlett, "Bartlett should have chi_square"
        assert "df" in bartlett, "Bartlett should have df"
        assert "p_value" in bartlett, "Bartlett should have p_value"
        assert "significant" in bartlett, "Bartlett should have significant flag"
        print(f"Bartlett: chi2={bartlett['chi_square']}, df={bartlett['df']}, p={bartlett['p_value']}")
        
        # Check scree plot data
        assert "scree_plot" in data, "Response should contain scree_plot"
        scree = data["scree_plot"]
        assert isinstance(scree, list), "Scree plot should be a list"
        if len(scree) > 0:
            assert "component" in scree[0], "Scree item should have component"
            assert "eigenvalue" in scree[0], "Scree item should have eigenvalue"
            print(f"Scree plot: {len(scree)} components, eigenvalues: {[s['eigenvalue'] for s in scree[:3]]}")
        
        # Check loading matrix
        assert "loading_matrix" in data, "Response should contain loading_matrix"
        loading_matrix = data["loading_matrix"]
        assert isinstance(loading_matrix, dict), "Loading matrix should be a dict"
        if loading_matrix:
            first_var = list(loading_matrix.keys())[0]
            assert "communality" in loading_matrix[first_var], "Loadings should include communality"
            print(f"Loading matrix: {len(loading_matrix)} variables")
        
        # Check factor interpretation
        assert "factor_interpretation" in data, "Response should contain factor_interpretation"
        interpretation = data["factor_interpretation"]
        assert isinstance(interpretation, list), "Factor interpretation should be a list"
        if len(interpretation) > 0:
            assert "factor" in interpretation[0], "Interpretation should have factor name"
            assert "high_loading_variables" in interpretation[0], "Interpretation should have high_loading_variables"
            print(f"Factor interpretation: {len(interpretation)} factors")
        
        # Check variance explained
        assert "variance_explained" in data, "Response should contain variance_explained"
        var_exp = data["variance_explained"]
        assert "by_factor" in var_exp, "Variance should have by_factor"
        assert "cumulative" in var_exp, "Variance should have cumulative"
        assert "total" in var_exp, "Variance should have total"
        print(f"Variance explained: {var_exp['total']}% total")
        
        # Check basic metadata
        assert "n_observations" in data, "Response should contain n_observations"
        assert "n_variables" in data, "Response should contain n_variables"
        assert "n_factors" in data, "Response should contain n_factors"
        assert "rotation" in data, "Response should contain rotation"
        print(f"Metadata: {data['n_observations']} obs, {data['n_variables']} vars, {data['n_factors']} factors")


class TestFactorAnalysisErrorHandling:
    """Test error handling for factor analysis"""

    def test_factor_analysis_missing_org_id(self, auth_headers):
        """Test that missing org_id returns error"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "variables": ["var1", "var2", "var3"]
            }
        )
        assert response.status_code == 422, f"Missing org_id should return 422, got {response.status_code}"
        print("Correctly rejects missing org_id")

    def test_factor_analysis_empty_variables(self, auth_headers, org_id):
        """Test that empty variables list returns error or error message"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers=auth_headers,
            json={
                "org_id": org_id,
                "variables": []
            }
        )
        # May return 400/422 for validation or 200 with error in body
        data = response.json()
        if response.status_code in [400, 422]:
            print(f"Returns {response.status_code} for empty variables")
        elif response.status_code == 200:
            # 200 with error message is valid (no data available case)
            assert "error" in data, f"Response should have error: {data}"
            print(f"Returns 200 with error for empty variables: {data.get('error')}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code}")

    def test_factor_analysis_without_auth(self, org_id):
        """Test factor analysis authentication handling"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/factor-analysis",
            headers={"Content-Type": "application/json"},
            json={
                "org_id": org_id,
                "variables": ["var1", "var2", "var3"]
            }
        )
        # Depending on API design, endpoint may:
        # 1. Require auth (401/403) 
        # 2. Allow public access with data restrictions (200 with error)
        if response.status_code in [401, 403]:
            print("Correctly requires authentication")
        elif response.status_code == 200:
            data = response.json()
            # Without auth, likely no data access
            assert "error" in data or "No data" in str(data), f"Unauthenticated should have limited access: {data}"
            print(f"Returns limited response without auth: {data}")
        else:
            print(f"Unexpected auth behavior: status={response.status_code}")


class TestAdvancedStatsPanelTabs:
    """Test that Advanced Stats Panel has 7 tabs including EFA"""

    def test_statistics_endpoints_available(self, auth_headers, org_id):
        """Test that all 7 statistics endpoints are available"""
        endpoints = [
            ("/api/statistics/ttest", "POST", {"org_id": org_id, "variable": "x", "test_type": "one_sample"}),
            ("/api/statistics/anova", "POST", {"org_id": org_id, "dependent_var": "x", "factor_var": "y"}),
            ("/api/statistics/correlation", "POST", {"org_id": org_id, "variables": ["x", "y"]}),
            ("/api/statistics/regression", "POST", {"org_id": org_id, "dependent_var": "x", "independent_vars": ["y"]}),
            ("/api/models/glm", "POST", {"org_id": org_id, "dependent_var": "x", "independent_vars": ["y"]}),
            ("/api/models/mixed", "POST", {"org_id": org_id, "dependent_var": "x", "fixed_effects": ["y"], "group_var": "z"}),
            ("/api/statistics/factor-analysis", "POST", {"org_id": org_id, "variables": ["x", "y", "z"]})
        ]
        
        results = []
        for endpoint, method, body in endpoints:
            if method == "POST":
                response = requests.post(
                    f"{BASE_URL}{endpoint}",
                    headers=auth_headers,
                    json=body
                )
            else:
                response = requests.get(f"{BASE_URL}{endpoint}", headers=auth_headers)
            
            # Endpoint should exist (not 404 or 405)
            exists = response.status_code not in [404, 405]
            results.append((endpoint, exists, response.status_code))
            print(f"{endpoint}: {'EXISTS' if exists else 'NOT FOUND'} (status: {response.status_code})")
        
        # All endpoints should exist
        for endpoint, exists, status in results:
            assert exists, f"Endpoint {endpoint} should exist, got status {status}"
        
        print(f"\nAll 7 statistics endpoints verified: T-Test, ANOVA, Correlation, Regression, GLM, Mixed, Factor Analysis")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
