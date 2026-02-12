"""
DataViz Studio API Tests
Tests for dashboard CRUD, chart data aggregation, and form listing APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials from seeding script
ORG_ID = "904d278e"
FORM_IDS = ["6d1cea4d", "33408ffd"]  # Customer Feedback Form, Product Usage Survey


class TestDataVizFormsAPI:
    """Tests for DataViz forms listing API"""
    
    def test_list_forms_for_dataviz(self):
        """Test GET /api/dataviz/forms/list returns seeded forms"""
        response = requests.get(f"{BASE_URL}/api/dataviz/forms/list?org_id={ORG_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "forms" in data
        assert len(data["forms"]) >= 2  # At least 2 seeded forms
        
        # Verify form structure
        for form in data["forms"]:
            assert "id" in form
            assert "name" in form
            assert "submission_count" in form


class TestDataVizChartDataAPI:
    """Tests for chart data aggregation API"""
    
    def test_chart_data_region_aggregation(self):
        """Test POST /api/dataviz/charts/data with region field"""
        response = requests.post(
            f"{BASE_URL}/api/dataviz/charts/data",
            json={
                "form_id": FORM_IDS[0],  # Customer Feedback Form
                "field": "region",
                "aggregation": "count"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert len(data["data"]) > 0  # Should have aggregated data
        
        # Verify structure and that we have region names
        for item in data["data"]:
            assert "name" in item
            assert "value" in item
            assert isinstance(item["value"], int)
            assert item["name"] in ["North", "South", "East", "West", "Central", "Unknown"]
    
    def test_chart_data_satisfaction_aggregation(self):
        """Test chart data for satisfaction field"""
        response = requests.post(
            f"{BASE_URL}/api/dataviz/charts/data",
            json={
                "form_id": FORM_IDS[0],
                "field": "satisfaction",
                "aggregation": "count"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert len(data["data"]) > 0
    
    def test_chart_data_product_aggregation(self):
        """Test chart data for product field on Product Usage Survey"""
        response = requests.post(
            f"{BASE_URL}/api/dataviz/charts/data",
            json={
                "form_id": FORM_IDS[1],  # Product Usage Survey
                "field": "product",
                "aggregation": "count"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
    
    def test_chart_data_with_group_by(self):
        """Test chart data with group_by parameter"""
        response = requests.post(
            f"{BASE_URL}/api/dataviz/charts/data",
            json={
                "form_id": FORM_IDS[0],
                "field": "satisfaction",
                "aggregation": "count",
                "group_by": "region"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data


class TestDataVizSummaryStatsAPI:
    """Tests for summary statistics API"""
    
    def test_get_summary_stats(self):
        """Test GET /api/dataviz/charts/summary-stats"""
        response = requests.get(f"{BASE_URL}/api/dataviz/charts/summary-stats?org_id={ORG_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all expected stats are present
        assert "total_submissions" in data
        assert "submissions_today" in data
        assert "submissions_week" in data
        assert "total_forms" in data
        assert "active_enumerators" in data
        
        # Verify seeded data is present
        assert data["total_submissions"] >= 500  # We seeded 500 submissions
        assert data["total_forms"] >= 2
        assert data["active_enumerators"] >= 1


class TestDataVizTimeSeriesAPI:
    """Tests for time series data API"""
    
    def test_time_series_by_day(self):
        """Test GET /api/dataviz/charts/time-series"""
        response = requests.get(
            f"{BASE_URL}/api/dataviz/charts/time-series",
            params={
                "form_id": FORM_IDS[0],
                "interval": "day",
                "days": 30
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert "interval" in data
        assert data["interval"] == "day"


class TestDataVizDashboardCRUD:
    """Tests for dashboard CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_dashboard_ids = []
    
    def test_create_dashboard(self):
        """Test POST /api/dataviz/dashboards"""
        response = requests.post(
            f"{BASE_URL}/api/dataviz/dashboards",
            params={"org_id": ORG_ID},
            json={
                "name": "TEST_Dashboard_DataViz",
                "description": "Test dashboard for DataViz testing",
                "widgets": [
                    {
                        "id": "w1",
                        "type": "chart",
                        "chart_type": "bar",
                        "title": "Region Distribution",
                        "data_source": FORM_IDS[0],
                        "field": "region",
                        "aggregation": "count",
                        "position": {"x": 0, "y": 0, "w": 6, "h": 4}
                    }
                ],
                "layout": "grid"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "message" in data
        assert data["message"] == "Dashboard created successfully"
        
        # Store for cleanup
        self.dashboard_id = data["id"]
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/dataviz/dashboards/{data['id']}")
        assert get_response.status_code == 200
        
        dashboard = get_response.json()
        assert dashboard["name"] == "TEST_Dashboard_DataViz"
        assert len(dashboard["widgets"]) == 1
    
    def test_list_dashboards(self):
        """Test GET /api/dataviz/dashboards"""
        response = requests.get(f"{BASE_URL}/api/dataviz/dashboards?org_id={ORG_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "dashboards" in data
        assert "count" in data
    
    def test_update_dashboard(self):
        """Test PUT /api/dataviz/dashboards/{id}"""
        # First create a dashboard
        create_response = requests.post(
            f"{BASE_URL}/api/dataviz/dashboards",
            params={"org_id": ORG_ID},
            json={
                "name": "TEST_Update_Dashboard",
                "description": "Dashboard to update",
                "widgets": [],
                "layout": "grid"
            }
        )
        
        assert create_response.status_code == 200
        dashboard_id = create_response.json()["id"]
        
        # Update it
        update_response = requests.put(
            f"{BASE_URL}/api/dataviz/dashboards/{dashboard_id}",
            json={
                "name": "TEST_Updated_Dashboard_Name",
                "description": "Updated description"
            }
        )
        
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/dataviz/dashboards/{dashboard_id}")
        assert get_response.status_code == 200
        
        dashboard = get_response.json()
        assert dashboard["name"] == "TEST_Updated_Dashboard_Name"
        assert dashboard["description"] == "Updated description"
    
    def test_delete_dashboard(self):
        """Test DELETE /api/dataviz/dashboards/{id}"""
        # First create a dashboard
        create_response = requests.post(
            f"{BASE_URL}/api/dataviz/dashboards",
            params={"org_id": ORG_ID},
            json={
                "name": "TEST_Delete_Dashboard",
                "description": "Dashboard to delete",
                "widgets": [],
                "layout": "grid"
            }
        )
        
        assert create_response.status_code == 200
        dashboard_id = create_response.json()["id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/dataviz/dashboards/{dashboard_id}")
        assert delete_response.status_code == 200
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/dataviz/dashboards/{dashboard_id}")
        assert get_response.status_code == 404


class TestDataVizTemplatesAPI:
    """Tests for dashboard templates API"""
    
    def test_get_templates(self):
        """Test GET /api/dataviz/templates"""
        response = requests.get(f"{BASE_URL}/api/dataviz/templates")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "templates" in data
        assert len(data["templates"]) >= 4  # At least 4 templates defined
        
        # Verify template structure
        for template in data["templates"]:
            assert "id" in template
            assert "name" in template
            assert "description" in template
            assert "widgets" in template


class TestDataVizFormFieldsAPI:
    """Tests for form fields API used by chart builder"""
    
    def test_get_form_fields(self):
        """Test GET /api/dataviz/forms/{form_id}/fields"""
        # Use the MongoDB ObjectId format (need to get actual form _id)
        # We'll test with the short form_id used in seeds which should map correctly
        response = requests.get(f"{BASE_URL}/api/dataviz/forms/list?org_id={ORG_ID}")
        
        if response.status_code == 200 and response.json().get("forms"):
            form_id = response.json()["forms"][0]["id"]
            
            fields_response = requests.get(f"{BASE_URL}/api/dataviz/forms/{form_id}/fields")
            
            assert fields_response.status_code == 200
            data = fields_response.json()
            
            assert "form_id" in data
            assert "form_name" in data
            assert "fields" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
