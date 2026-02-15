"""
DataPulse DataViz Module Backend API Tests
Testing comprehensive DataViz functionality including:
- Charts endpoints (GET /api/charts)
- Dashboards endpoints (GET /api/dashboards, POST /api/dashboards)
- DataViz integration endpoints
"""

import requests
import sys
import json
from datetime import datetime
from typing import Optional

API_URL = "https://datapulse-dash.preview.emergentagent.com"
ORG_ID = "878035eb-5e4f-4305-8075-31eb8fd66580"
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"

class DataVizAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.user_id = None
        self.created_dashboard_id = None
        
    def log_test(self, name: str, success: bool, message: str = "", response_data=None):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"\n{status}: {name}")
        if message:
            print(f"  Details: {message}")
        if response_data and not success:
            print(f"  Response: {response_data}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({
                "test": name,
                "message": message,
                "response": response_data
            })
    
    def make_request(self, method: str, endpoint: str, data=None, params=None, expect_status=200):
        """Make HTTP request with proper headers"""
        url = f"{API_URL}/api{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, params=params, timeout=15)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, params=params, timeout=15)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=15)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expect_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text[:500]}
            
            return success, response_data
            
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_login(self):
        """Test login to get authentication token"""
        print("\n🔐 Testing Authentication...")
        
        success, response = self.make_request(
            'POST', 
            '/auth/login',
            data={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        if success and ('token' in response or 'access_token' in response):
            self.token = response.get('token') or response.get('access_token')
            self.user_id = response.get('user', {}).get('id')
            self.log_test("DataViz Login Authentication", True, f"Token obtained for user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        else:
            self.log_test("DataViz Login Authentication", False, "Failed to authenticate", response)
            return False
    
    def test_charts_endpoints(self):
        """Test Charts-related endpoints"""
        print("\n📊 Testing Charts Endpoints...")
        
        # Test GET /api/charts - Note: Charts API may not be implemented yet
        success, response = self.make_request('GET', '/charts', params={'org_id': ORG_ID})
        if response.get('detail') == 'Not Found':
            self.log_test(
                "GET /api/charts - Charts API Endpoint", 
                False, 
                "Charts API endpoint not found - this feature may need backend implementation",
                response
            )
        else:
            self.log_test(
                "GET /api/charts - List Charts", 
                success and 'charts' in response,
                f"Found {len(response.get('charts', []))} charts" if success else "Failed to fetch charts",
                response if not success else None
            )
        
        # Test chart-related endpoints in analysis routes
        success, response = self.make_request('GET', '/analysis/charts/heatmap', expect_status=405)
        if response.get('detail') == 'Method Not Allowed':
            self.log_test(
                "Analysis Charts Integration", 
                True, 
                "Chart analysis endpoints exist but require POST requests (as expected)"
            )
        else:
            self.log_test("Analysis Charts Integration", False, "Chart analysis endpoints not found", response)
    
    def test_dashboards_endpoints(self):
        """Test Dashboards-related endpoints"""
        print("\n📋 Testing Dashboards Endpoints...")
        
        # Test GET /api/dashboards - list dashboards (might need different approach)
        success, response = self.make_request('GET', '/dashboards', params={'org_id': ORG_ID})
        if response.get('detail') == 'Method Not Allowed':
            self.log_test(
                "GET /api/dashboards - List Dashboards", 
                False,
                "Dashboards GET endpoint not properly implemented - might need different HTTP method or route structure",
                response
            )
        else:
            self.log_test(
                "GET /api/dashboards - List Dashboards", 
                success and 'dashboards' in response,
                f"Found {len(response.get('dashboards', []))} dashboards" if success else "Failed to fetch dashboards",
                response if not success else None
            )
        
        # Test POST /api/dashboards - create dashboard
        dashboard_data = {
            "name": "Test DataViz Dashboard",
            "description": "Test dashboard created by API testing",
            "org_id": ORG_ID,
            "widgets": []
        }
        
        success, response = self.make_request('POST', '/dashboards', data=dashboard_data)
        if success and ('id' in response or 'dashboard_id' in response):
            self.created_dashboard_id = response.get('id') or response.get('dashboard_id')
            self.log_test(
                "POST /api/dashboards - Create Dashboard", 
                True,
                f"Dashboard created successfully with ID: {self.created_dashboard_id}"
            )
        else:
            self.log_test(
                "POST /api/dashboards - Create Dashboard", 
                False,
                "Failed to create dashboard",
                response
            )
        
        # Test dashboard retrieval if we have an ID
        if self.created_dashboard_id:
            success, response = self.make_request('GET', f'/dashboards/{self.created_dashboard_id}')
            # Handle both single dashboard object and list responses
            dashboard_data = response if isinstance(response, dict) else (response[0] if response and isinstance(response, list) else {})
            self.log_test(
                "GET /api/dashboards/{id} - Get Dashboard Details", 
                success and ('name' in dashboard_data),
                f"Retrieved dashboard: {dashboard_data.get('name', 'Unknown')}" if success else "Failed to get dashboard details",
                response if not success else None
            )
    
    def test_datasets_endpoints(self):
        """Test Datasets endpoints (required for DataViz)"""
        print("\n🗃️ Testing Datasets Endpoints (DataViz dependency)...")
        
        # Test GET /api/datasets - list datasets (needed for charts/dashboards)
        success, response = self.make_request('GET', '/datasets', params={'org_id': ORG_ID})
        if response.get('detail') == 'Method Not Allowed':
            self.log_test(
                "GET /api/datasets - List Datasets", 
                False,
                "Datasets GET endpoint not properly implemented",
                response
            )
            return
        
        self.log_test(
            "GET /api/datasets - List Datasets", 
            success and 'datasets' in response,
            f"Found {len(response.get('datasets', []))} datasets available for DataViz" if success else "Failed to fetch datasets",
            response if not success else None
        )
        
        # Check if any datasets exist for DataViz features
        if success and response.get('datasets'):
            dataset = response['datasets'][0]
            dataset_id = dataset.get('id')
            
            # Test dataset data retrieval (needed for chart preview)
            if dataset_id:
                success, response = self.make_request('GET', f'/datasets/{dataset_id}/data', params={'limit': 10})
                self.log_test(
                    "GET /api/datasets/{id}/data - Dataset Data for Charts", 
                    success and 'data' in response,
                    f"Retrieved {len(response.get('data', []))} data rows for visualization" if success else "Failed to get dataset data",
                    response if not success else None
                )
    
    def test_widget_endpoints(self):
        """Test Widget endpoints (for dashboard builder)"""
        print("\n🧩 Testing Widget Endpoints...")
        
        # Only test if we have a created dashboard
        if not self.created_dashboard_id:
            self.log_test("Widget Endpoints", False, "No dashboard available for widget testing")
            return
        
        # Test widget creation
        widget_data = {
            "dashboard_id": self.created_dashboard_id,
            "type": "stat",
            "title": "Test Widget",
            "config": {"aggregation": "count"},
            "position": {"x": 0, "y": 0, "w": 4, "h": 3}
        }
        
        success, response = self.make_request('POST', '/widgets', data=widget_data)
        widget_id = None
        if success and ('id' in response or 'widget_id' in response):
            widget_id = response.get('id') or response.get('widget_id')
            self.log_test(
                "POST /api/widgets - Create Widget", 
                True,
                f"Widget created successfully with ID: {widget_id}"
            )
        else:
            self.log_test(
                "POST /api/widgets - Create Widget", 
                False,
                "Failed to create widget",
                response
            )
        
        # Test getting dashboard widgets
        success, response = self.make_request('GET', f'/dashboards/{self.created_dashboard_id}/widgets')
        self.log_test(
            "GET /api/dashboards/{id}/widgets - Get Dashboard Widgets", 
            success and 'widgets' in response,
            f"Found {len(response.get('widgets', []))} widgets" if success else "Failed to get dashboard widgets",
            response if not success else None
        )
        
        # Clean up widget if created
        if widget_id:
            self.make_request('DELETE', f'/widgets/{widget_id}')
    
    def test_ai_suggestions(self):
        """Test AI suggestions endpoints"""
        print("\n🤖 Testing AI Suggestions (Chart Studio feature)...")
        
        # Test AI chart suggestions
        success_datasets, datasets_response = self.make_request('GET', '/datasets', params={'org_id': ORG_ID})
        if success_datasets and datasets_response.get('datasets'):
            dataset_id = datasets_response['datasets'][0]['id']
            
            success, response = self.make_request('POST', f'/ai/suggest-charts', params={'dataset_id': dataset_id})
            self.log_test(
                "POST /api/ai/suggest-charts - AI Chart Suggestions", 
                success and 'suggestions' in response,
                f"AI generated {len(response.get('suggestions', []))} chart suggestions" if success else "Failed to get AI suggestions",
                response if not success else None
            )
        else:
            self.log_test("AI Chart Suggestions", False, "No datasets available for AI suggestions")
    
    def cleanup_resources(self):
        """Clean up created test resources"""
        print("\n🧹 Cleaning up test resources...")
        
        if self.created_dashboard_id:
            success, response = self.make_request('DELETE', f'/dashboards/{self.created_dashboard_id}')
            if success:
                print(f"  ✅ Cleaned up test dashboard: {self.created_dashboard_id}")
            else:
                print(f"  ⚠️ Failed to clean up dashboard: {self.created_dashboard_id}")
    
    def run_all_tests(self):
        """Run all DataViz API tests"""
        print("🚀 Starting DataPulse DataViz Module API Tests")
        print("=" * 60)
        
        # Authentication is required for all other tests
        if not self.test_login():
            print("\n❌ Authentication failed - cannot proceed with DataViz tests")
            return False
        
        # Run all DataViz tests
        self.test_datasets_endpoints()  # Dependency for DataViz
        self.test_charts_endpoints()
        self.test_dashboards_endpoints()
        self.test_widget_endpoints()
        self.test_ai_suggestions()
        
        # Clean up test resources
        self.cleanup_resources()
        
        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 DATAVIZ TEST SUMMARY")
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for i, test in enumerate(self.failed_tests, 1):
                print(f"{i}. {test['test']}: {test['message']}")
        
        return len(self.failed_tests) == 0


def main():
    """Main test execution"""
    tester = DataVizAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()