"""
DataPulse User Management Backend API Tests
Testing comprehensive user management functionality including:
- User listing and filtering
- User statistics
- User updates
- Bulk actions
- Password policy management
- Activity tracking
- Session management
"""

import requests
import sys
import json
from datetime import datetime
from typing import Optional

API_URL = "https://dashboard-assist.preview.emergentagent.com"
ORG_ID = "6fcd0e42-e56c-47e1-999a-32a52e94c677"
TEST_EMAIL = "testuser_095957@datapulse.io"
TEST_PASSWORD = "Test123!"

class UserManagementAPITester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.user_id = None  # Will be set after login
        
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
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, params=params, timeout=10)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=headers, json=data, params=params, timeout=10)
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
            self.log_test("Login Authentication", True, f"Token obtained for user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        else:
            self.log_test("Login Authentication", False, "Failed to authenticate", response)
            return False
    
    def test_user_listing(self):
        """Test GET /api/users - list users with filtering"""
        print("\n👥 Testing User Listing...")
        
        # Test basic user listing
        success, response = self.make_request('GET', '/users', params={'org_id': ORG_ID})
        self.log_test(
            "List All Users", 
            success and 'users' in response,
            f"Found {len(response.get('users', []))} users" if success else "Failed to fetch users",
            response if not success else None
        )
        
        # Test search functionality
        success, response = self.make_request('GET', '/users', params={
            'org_id': ORG_ID,
            'search': 'demo'
        })
        self.log_test(
            "Search Users", 
            success and 'users' in response,
            f"Search returned {len(response.get('users', []))} users" if success else "Search failed",
            response if not success else None
        )
        
        # Test status filtering
        success, response = self.make_request('GET', '/users', params={
            'org_id': ORG_ID,
            'status': 'active'
        })
        self.log_test(
            "Filter Users by Status", 
            success and 'users' in response,
            f"Active users: {len(response.get('users', []))}" if success else "Status filtering failed",
            response if not success else None
        )
        
        # Test role filtering
        success, response = self.make_request('GET', '/users', params={
            'org_id': ORG_ID,
            'role': 'admin'
        })
        self.log_test(
            "Filter Users by Role", 
            success and 'users' in response,
            f"Admin users: {len(response.get('users', []))}" if success else "Role filtering failed",
            response if not success else None
        )
        
        # Test pagination
        success, response = self.make_request('GET', '/users', params={
            'org_id': ORG_ID,
            'page': 1,
            'page_size': 5
        })
        self.log_test(
            "User Pagination", 
            success and 'users' in response and 'total_pages' in response,
            f"Page 1: {len(response.get('users', []))} users, Total pages: {response.get('total_pages', 0)}" if success else "Pagination failed",
            response if not success else None
        )
    
    def test_user_statistics(self):
        """Test GET /api/users/stats - get user statistics"""
        print("\n📊 Testing User Statistics...")
        
        success, response = self.make_request('GET', '/users/stats', params={'org_id': ORG_ID})
        
        expected_fields = ['total_users', 'active_users', 'active_sessions', 'failed_logins_24h']
        has_required_fields = all(field in response for field in expected_fields)
        
        self.log_test(
            "User Statistics", 
            success and has_required_fields,
            f"Stats: {response.get('total_users', 0)} total, {response.get('active_users', 0)} active, {response.get('active_sessions', 0)} sessions" if success else "Statistics fetch failed",
            response if not success else None
        )
    
    def test_user_details(self):
        """Test GET /api/users/{user_id} - get user details"""
        if not self.user_id:
            self.log_test("User Details", False, "No user_id available for testing")
            return
        
        print(f"\n👤 Testing User Details for user: {self.user_id}...")
        
        success, response = self.make_request('GET', f'/users/{self.user_id}', params={'org_id': ORG_ID})
        
        expected_sections = ['user', 'membership', 'recent_activity']
        has_required_sections = all(section in response for section in expected_sections)
        
        self.log_test(
            "User Details", 
            success and has_required_sections,
            f"Retrieved user details with {len(response.get('recent_activity', []))} recent activities" if success else "User details fetch failed",
            response if not success else None
        )
    
    def test_user_update(self):
        """Test PUT /api/users/{user_id} - update user"""
        if not self.user_id:
            self.log_test("User Update", False, "No user_id available for testing")
            return
            
        print(f"\n✏️ Testing User Update for user: {self.user_id}...")
        
        update_data = {
            "department": "Testing Department",
            "job_title": "Test Manager"
        }
        
        success, response = self.make_request(
            'PUT', 
            f'/users/{self.user_id}', 
            data=update_data,
            params={'org_id': ORG_ID}
        )
        
        self.log_test(
            "User Update", 
            success and response.get('message') == 'User updated successfully',
            "User profile updated successfully" if success else "User update failed",
            response if not success else None
        )
    
    def test_bulk_actions(self):
        """Test POST /api/users/bulk-action - bulk user actions"""
        if not self.user_id:
            self.log_test("Bulk User Actions", False, "No user_id available for testing")
            return
            
        print(f"\n🔄 Testing Bulk User Actions...")
        
        # Test bulk suspend (then reactivate to avoid breaking the demo user)
        bulk_data = {
            "user_ids": [self.user_id],
            "action": "suspend",
            "reason": "Testing bulk suspend functionality"
        }
        
        success, response = self.make_request(
            'POST', 
            '/users/bulk-action',
            data=bulk_data,
            params={'org_id': ORG_ID}
        )
        
        self.log_test(
            "Bulk Suspend Users", 
            success and 'success' in response,
            f"Suspended {len(response.get('success', []))} users" if success else "Bulk suspend failed",
            response if not success else None
        )
        
        # Reactivate the user
        if success:
            reactivate_data = {
                "user_ids": [self.user_id],
                "action": "activate",
                "reason": "Reactivating after test"
            }
            
            success, response = self.make_request(
                'POST', 
                '/users/bulk-action',
                data=reactivate_data,
                params={'org_id': ORG_ID}
            )
            
            self.log_test(
                "Bulk Reactivate Users", 
                success and 'success' in response,
                f"Reactivated {len(response.get('success', []))} users" if success else "Bulk reactivate failed",
                response if not success else None
            )
    
    def test_password_policy(self):
        """Test GET/PUT /api/users/password-policy - password policy management"""
        print("\n🔒 Testing Password Policy...")
        
        # Test getting password policy
        success, response = self.make_request('GET', '/users/password-policy', params={'org_id': ORG_ID})
        
        expected_fields = ['min_length', 'require_uppercase', 'require_lowercase', 'require_numbers', 'max_failed_attempts']
        has_required_fields = all(field in response for field in expected_fields)
        
        self.log_test(
            "Get Password Policy", 
            success and has_required_fields,
            f"Policy: min_length={response.get('min_length', 'N/A')}, max_failed_attempts={response.get('max_failed_attempts', 'N/A')}" if success else "Get password policy failed",
            response if not success else None
        )
        
        # Test updating password policy
        if success:
            updated_policy = response.copy()
            updated_policy['min_length'] = 10  # Change minimum length to test update
            
            success, response = self.make_request(
                'PUT', 
                '/users/password-policy',
                data=updated_policy,
                params={'org_id': ORG_ID}
            )
            
            self.log_test(
                "Update Password Policy", 
                success and response.get('message') == 'Password policy updated successfully',
                "Password policy updated successfully" if success else "Password policy update failed",
                response if not success else None
            )
    
    def test_user_activity(self):
        """Test GET /api/users/activity/all - get all user activity"""
        print("\n📈 Testing User Activity...")
        
        success, response = self.make_request('GET', '/users/activity/all', params={
            'org_id': ORG_ID,
            'page_size': 20
        })
        
        self.log_test(
            "Get All User Activity", 
            success and 'activities' in response,
            f"Retrieved {len(response.get('activities', []))} activities" if success else "Activity fetch failed",
            response if not success else None
        )
    
    def test_suspicious_activity(self):
        """Test GET /api/users/login-history/suspicious - get suspicious login activity"""
        print("\n🚨 Testing Suspicious Activity Detection...")
        
        success, response = self.make_request('GET', '/users/login-history/suspicious', params={'org_id': ORG_ID})
        
        self.log_test(
            "Get Suspicious Activity", 
            success and 'suspicious_activity' in response,
            f"Found {len(response.get('suspicious_activity', []))} suspicious activities" if success else "Suspicious activity fetch failed",
            response if not success else None
        )
    
    def test_active_sessions(self):
        """Test GET /api/users/sessions/active - get active sessions"""
        print("\n💻 Testing Active Sessions...")
        
        success, response = self.make_request('GET', '/users/sessions/active', params={'org_id': ORG_ID})
        
        self.log_test(
            "Get Active Sessions", 
            success and 'sessions' in response,
            f"Found {response.get('total', 0)} active sessions" if success else "Active sessions fetch failed",
            response if not success else None
        )
    
    def test_user_sessions(self):
        """Test GET /api/users/{user_id}/sessions - get user-specific sessions"""
        if not self.user_id:
            self.log_test("User Sessions", False, "No user_id available for testing")
            return
            
        print(f"\n🖥️ Testing User Sessions for user: {self.user_id}...")
        
        success, response = self.make_request('GET', f'/users/{self.user_id}/sessions', params={'org_id': ORG_ID})
        
        self.log_test(
            "Get User Sessions", 
            success and 'sessions' in response,
            f"User has {len(response.get('sessions', []))} sessions" if success else "User sessions fetch failed",
            response if not success else None
        )
    
    def run_all_tests(self):
        """Run all user management API tests"""
        print("🚀 Starting DataPulse User Management API Tests")
        print("=" * 60)
        
        # Authentication is required for all other tests
        if not self.test_login():
            print("\n❌ Authentication failed - cannot proceed with other tests")
            return False
        
        # Run all user management tests
        self.test_user_listing()
        self.test_user_statistics()
        self.test_user_details()
        self.test_user_update()
        self.test_bulk_actions()
        self.test_password_policy()
        self.test_user_activity()
        self.test_suspicious_activity()
        self.test_active_sessions()
        self.test_user_sessions()
        
        # Print final results
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY")
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
    tester = UserManagementAPITester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()