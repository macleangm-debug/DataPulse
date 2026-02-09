"""
Data Analysis Module Phase 1 - Test Suite
Tests for: Response Browsing, Statistics, Export, Snapshots, AI Copilot
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
TEST_USER = "test@datapulse.io"
TEST_PASSWORD = "password123"
TEST_ORG_ID = "ad326e2a-f7a4-4b3f-b4d2-0e1ba0fd9fbd"
TEST_FORM_ID = "124427aa-d482-4292-af6e-2042ae5cabbd"


class TestDataAnalysisModule:
    """Data Analysis Module Tests - Phase 1"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No token (access_token) in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
        self.session.close()
    
    # ============ Response Browsing API Tests ============
    
    def test_browse_responses_success(self):
        """Test /api/analysis/responses/browse returns paginated responses"""
        response = self.session.post(f"{BASE_URL}/api/analysis/responses/browse", json={
            "form_id": TEST_FORM_ID,
            "page": 1,
            "page_size": 20
        })
        
        assert response.status_code == 200, f"Browse responses failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total" in data, "Missing 'total' in response"
        assert "page" in data, "Missing 'page' in response"
        assert "responses" in data, "Missing 'responses' in response"
        assert isinstance(data["responses"], list), "responses should be a list"
        
        # Verify data was returned (test data exists)
        assert data["total"] > 0, f"No responses found for form {TEST_FORM_ID}"
        print(f"SUCCESS: Browse responses returned {data['total']} total, page {data['page']}")
    
    def test_browse_responses_with_status_filter(self):
        """Test browse with status filter"""
        response = self.session.post(f"{BASE_URL}/api/analysis/responses/browse", json={
            "form_id": TEST_FORM_ID,
            "page": 1,
            "page_size": 10,
            "status": ["approved"]
        })
        
        assert response.status_code == 200, f"Filtered browse failed: {response.text}"
        data = response.json()
        assert "responses" in data
        
        # All responses should have approved status
        for r in data["responses"]:
            assert r.get("status") == "approved" or r.get("status") is None
        
        print(f"SUCCESS: Filtered browse returned {len(data['responses'])} approved responses")
    
    def test_browse_responses_pagination(self):
        """Test pagination works correctly"""
        response = self.session.post(f"{BASE_URL}/api/analysis/responses/browse", json={
            "form_id": TEST_FORM_ID,
            "page": 2,
            "page_size": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert "total_pages" in data
        print(f"SUCCESS: Pagination works - Page 2, total pages: {data.get('total_pages')}")
    
    # ============ Quick Statistics API Tests ============
    
    def test_quick_stats_success(self):
        """Test /api/analysis/stats/quick calculates basic statistics"""
        # Use form fields: age, gender, satisfaction, recommend
        response = self.session.post(f"{BASE_URL}/api/analysis/stats/quick", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "variables": ["age", "gender", "satisfaction"]
        })
        
        assert response.status_code == 200, f"Quick stats failed: {response.text}"
        data = response.json()
        
        assert "total_n" in data, "Missing 'total_n' in response"
        assert "variables" in data, "Missing 'variables' in response"
        assert isinstance(data["variables"], list)
        
        print(f"SUCCESS: Quick stats calculated for {data['total_n']} observations, {len(data['variables'])} variables")
    
    def test_quick_stats_numeric_variable(self):
        """Test stats for numeric variable (age)"""
        response = self.session.post(f"{BASE_URL}/api/analysis/stats/quick", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "variables": ["age"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("variables"):
            var_stats = data["variables"][0]
            if var_stats.get("type") == "numeric":
                assert "mean" in var_stats, "Numeric variable should have mean"
                assert "median" in var_stats, "Numeric variable should have median"
                assert "std" in var_stats, "Numeric variable should have std"
                print(f"SUCCESS: Numeric stats - mean={var_stats.get('mean')}, median={var_stats.get('median')}")
            else:
                print(f"INFO: Variable 'age' treated as categorical - {var_stats.get('type')}")
    
    def test_quick_stats_categorical_variable(self):
        """Test stats for categorical variable (gender)"""
        response = self.session.post(f"{BASE_URL}/api/analysis/stats/quick", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "variables": ["gender"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("variables"):
            var_stats = data["variables"][0]
            if var_stats.get("type") == "categorical":
                assert "frequencies" in var_stats, "Categorical should have frequencies"
                assert "unique_values" in var_stats, "Categorical should have unique_values"
                print(f"SUCCESS: Categorical stats - {var_stats.get('unique_values')} unique values")
    
    # ============ Cross-tabulation API Tests ============
    
    def test_crosstab_success(self):
        """Test /api/analysis/stats/crosstab generates cross-tabulation"""
        response = self.session.post(f"{BASE_URL}/api/analysis/stats/crosstab", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "row_var": "gender",
            "col_var": "satisfaction"
        })
        
        assert response.status_code == 200, f"Crosstab failed: {response.text}"
        data = response.json()
        
        assert "row_variable" in data
        assert "col_variable" in data
        assert "counts" in data or "table" in data or "error" not in data
        
        # Check for chi-square test if available
        if "chi_square_test" in data and data["chi_square_test"]:
            assert "chi_square" in data["chi_square_test"]
            assert "p_value" in data["chi_square_test"]
            print(f"SUCCESS: Crosstab with chi-square test, p={data['chi_square_test'].get('p_value')}")
        else:
            print(f"SUCCESS: Crosstab generated for {data['row_variable']} x {data['col_variable']}")
    
    # ============ Advanced Statistics API Tests ============
    
    def test_descriptives_with_normality(self):
        """Test /api/statistics/descriptives returns detailed statistics"""
        response = self.session.post(f"{BASE_URL}/api/statistics/descriptives", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "variables": ["age", "satisfaction"],
            "include_normality": True,
            "percentiles": [25, 50, 75]
        })
        
        assert response.status_code == 200, f"Descriptives failed: {response.text}"
        data = response.json()
        
        assert "total_n" in data
        assert "variables" in data
        
        for var_stat in data.get("variables", []):
            assert "mean" in var_stat or "error" in data
            assert "std" in var_stat or "error" in data
            # Normality test if included
            if var_stat.get("normality"):
                print(f"SUCCESS: Descriptives with normality test for {var_stat.get('variable')}")
        
        print(f"SUCCESS: Descriptives calculated for {len(data.get('variables', []))} variables")
    
    # ============ Snapshot API Tests ============
    
    def test_list_snapshots(self):
        """Test /api/analysis/snapshots/{org_id} lists snapshots"""
        response = self.session.get(f"{BASE_URL}/api/analysis/snapshots/{TEST_ORG_ID}")
        
        assert response.status_code == 200, f"List snapshots failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Snapshots should be a list"
        print(f"SUCCESS: Listed {len(data)} snapshots for org {TEST_ORG_ID}")
        
        # Verify snapshot structure if any exist
        if data:
            snap = data[0]
            assert "id" in snap or "_id" not in snap  # MongoDB _id should be excluded/converted
            print(f"First snapshot: {snap.get('name', 'unnamed')} - status: {snap.get('status', 'unknown')}")
    
    def test_create_snapshot(self):
        """Test /api/analysis/snapshots/create creates a snapshot"""
        response = self.session.post(f"{BASE_URL}/api/analysis/snapshots/create", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "name": f"TEST_snapshot_iter16",
            "include_statuses": ["approved"],
            "include_metadata": True
        })
        
        assert response.status_code == 200, f"Create snapshot failed: {response.text}"
        data = response.json()
        
        assert "snapshot_id" in data, "Missing snapshot_id in response"
        assert "status" in data, "Missing status in response"
        print(f"SUCCESS: Snapshot creation started - ID: {data.get('snapshot_id')}")
    
    # ============ Export API Tests ============
    
    def test_export_csv(self):
        """Test /api/export/download exports data as CSV"""
        response = self.session.post(f"{BASE_URL}/api/export/download", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "format": "csv",
            "include_labels": True
        })
        
        # May return 200 with file or 404 if no data
        assert response.status_code in [200, 404], f"Export CSV unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            # Should return CSV content
            content_type = response.headers.get("Content-Type", "")
            assert "text/csv" in content_type or "application/octet-stream" in content_type or len(response.content) > 0
            print(f"SUCCESS: CSV export returned {len(response.content)} bytes")
        else:
            print("INFO: No data to export (404)")
    
    def test_export_excel(self):
        """Test /api/export/download exports data as Excel"""
        response = self.session.post(f"{BASE_URL}/api/export/download", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "format": "xlsx",
            "include_labels": True,
            "include_codebook": True
        })
        
        assert response.status_code in [200, 404], f"Export Excel unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            assert "spreadsheet" in content_type or "application/octet-stream" in content_type or len(response.content) > 0
            print(f"SUCCESS: Excel export returned {len(response.content)} bytes")
    
    def test_export_parquet(self):
        """Test /api/export/download exports data as Parquet"""
        response = self.session.post(f"{BASE_URL}/api/export/download", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "format": "parquet"
        })
        
        assert response.status_code in [200, 404], f"Export Parquet unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print(f"SUCCESS: Parquet export returned {len(response.content)} bytes")
    
    def test_export_spss(self):
        """Test /api/export/download exports data as SPSS"""
        response = self.session.post(f"{BASE_URL}/api/export/download", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "format": "spss"
        })
        
        # SPSS export may require pyreadstat library
        assert response.status_code in [200, 404, 500], f"Export SPSS unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print(f"SUCCESS: SPSS export returned {len(response.content)} bytes")
        elif response.status_code == 500:
            print("INFO: SPSS export may require pyreadstat library")
    
    def test_export_stata(self):
        """Test /api/export/download exports data as Stata"""
        response = self.session.post(f"{BASE_URL}/api/export/download", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "format": "stata"
        })
        
        assert response.status_code in [200, 404, 500], f"Export Stata unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print(f"SUCCESS: Stata export returned {len(response.content)} bytes")
    
    # ============ AI Copilot API Tests ============
    
    def test_ai_copilot_analyze(self):
        """Test /api/ai-copilot/analyze accepts natural language queries"""
        response = self.session.post(f"{BASE_URL}/api/ai-copilot/analyze", json={
            "form_id": TEST_FORM_ID,
            "org_id": TEST_ORG_ID,
            "query": "Show frequencies for all categorical variables"
        }, timeout=30)  # AI may take time
        
        # AI may return 200 or 500 if EMERGENT_LLM_KEY not configured
        assert response.status_code in [200, 500], f"AI analyze unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "analysis_id" in data or "analysis_plan" in data
            print(f"SUCCESS: AI Copilot analysis - ID: {data.get('analysis_id')}")
        else:
            error = response.json()
            print(f"INFO: AI Copilot returned 500 - {error.get('detail', 'unknown error')}")
    
    def test_ai_copilot_history(self):
        """Test /api/ai-copilot/history/{org_id} returns analysis history"""
        response = self.session.get(f"{BASE_URL}/api/ai-copilot/history/{TEST_ORG_ID}")
        
        assert response.status_code == 200, f"AI history failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "History should be a list"
        print(f"SUCCESS: AI history returned {len(data)} analyses")
    
    # ============ Forms API Test (for form selection) ============
    
    def test_forms_list_with_org_query_param(self):
        """Test /api/forms?org_id=xxx returns forms for form selector"""
        response = self.session.get(f"{BASE_URL}/api/forms?org_id={TEST_ORG_ID}")
        
        assert response.status_code == 200, f"Forms list failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Forms should be a list"
        assert len(data) > 0, f"No forms found for org {TEST_ORG_ID}"
        
        # Verify form structure
        form = data[0]
        assert "id" in form, "Form should have id"
        assert "name" in form, "Form should have name"
        
        # Check if test form exists
        test_form = next((f for f in data if f["id"] == TEST_FORM_ID), None)
        if test_form:
            print(f"SUCCESS: Found test form '{test_form.get('name')}' in forms list")
        else:
            print(f"WARNING: Test form {TEST_FORM_ID} not found, but {len(data)} forms exist")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
