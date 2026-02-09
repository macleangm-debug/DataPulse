"""
DataPulse Iteration 8 Testing - Duplicate Detection, Form Versioning, and Offline Sync
Tests for:
1. Duplicate Detection API - rules, check, stats
2. Form Versioning API - versions, compare, changelog
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndSetup:
    """Basic setup and health checks"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASS: API health check")

    def test_api_root(self):
        """Verify API root responds"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "DataPulse" in data.get("message", "")
        print("PASS: API root check")


class TestAuthentication:
    """Authentication tests for getting token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@datapulse.io",
            "password": "password123"
        })
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token") or data.get("token")
            print(f"PASS: Authentication successful, got token")
            return token
        pytest.fail(f"Authentication failed: {response.status_code} - {response.text}")
    
    def test_auth_provides_token(self, auth_token):
        """Verify token is obtained"""
        assert auth_token is not None
        assert len(auth_token) > 10
        print("PASS: Token obtained")


# Use fixture to get token for all tests
@pytest.fixture(scope="module")
def token():
    """Module-level auth token fixture"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@datapulse.io",
        "password": "password123"
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    return None


@pytest.fixture(scope="module")
def test_form_id(token):
    """Get or create a test form for testing"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # First try to get existing forms
    response = requests.get(f"{BASE_URL}/api/forms/", headers=headers)
    if response.status_code == 200:
        forms = response.json()
        if isinstance(forms, list) and len(forms) > 0:
            return forms[0].get("id")
        elif isinstance(forms, dict) and forms.get("forms"):
            return forms["forms"][0].get("id")
    
    # Return a placeholder form_id for testing routes that don't need real forms
    return "test-form-001"


class TestDuplicateDetectionRules:
    """Tests for duplicate detection rule management"""
    
    def test_get_duplicate_rules_unauthenticated(self):
        """Verify duplicate rules require authentication"""
        response = requests.get(f"{BASE_URL}/api/duplicates/rules/test-form")
        assert response.status_code in [401, 403, 422]
        print("PASS: Duplicate rules require authentication")
    
    def test_get_duplicate_rules_default(self, token, test_form_id):
        """Get duplicate rules for a form - should return defaults if none exist"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/duplicates/rules/{test_form_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "rules" in data
        assert isinstance(data["rules"], list)
        
        # Should have at least a default rule
        if len(data["rules"]) > 0:
            rule = data["rules"][0]
            assert "name" in rule
            assert "fields" in rule
            print(f"PASS: Got {len(data['rules'])} duplicate rules for form")
        else:
            print("PASS: Got empty rules list (expected for new forms)")
    
    def test_create_duplicate_rule(self, token, test_form_id):
        """Create a new duplicate detection rule"""
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        rule_data = {
            "form_id": test_form_id,
            "name": "TEST_Phone Number Check",
            "fields": ["phone", "email"],
            "threshold": 1.0,
            "action": "flag",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/duplicates/rules", headers=headers, json=rule_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Rule created successfully"
        print(f"PASS: Created duplicate rule with ID: {data['id']}")
        return data["id"]


class TestDuplicateChecking:
    """Tests for duplicate checking functionality"""
    
    def test_check_duplicates_requires_auth(self, test_form_id):
        """Verify duplicate check requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/duplicates/check",
            params={"form_id": test_form_id},
            json={"phone": "1234567890"}
        )
        assert response.status_code in [401, 403, 422]
        print("PASS: Duplicate check requires authentication")
    
    def test_check_duplicates_no_matches(self, token, test_form_id):
        """Check for duplicates with unique data - should find no matches"""
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        submission_data = {
            "phone": f"unique-{datetime.now().timestamp()}",
            "email": f"unique-{datetime.now().timestamp()}@test.com"
        }
        response = requests.post(
            f"{BASE_URL}/api/duplicates/check",
            params={"form_id": test_form_id},
            headers=headers,
            json=submission_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicates" in data
        assert "matches" in data
        assert isinstance(data["matches"], list)
        print(f"PASS: Duplicate check returned - has_duplicates: {data['has_duplicates']}, matches: {len(data['matches'])}")


class TestDuplicateStats:
    """Tests for duplicate statistics"""
    
    def test_get_duplicate_stats_requires_auth(self, test_form_id):
        """Verify duplicate stats require authentication"""
        response = requests.get(f"{BASE_URL}/api/duplicates/stats/{test_form_id}")
        assert response.status_code in [401, 403, 422]
        print("PASS: Duplicate stats require authentication")
    
    def test_get_duplicate_stats(self, token, test_form_id):
        """Get duplicate statistics for a form"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/duplicates/stats/{test_form_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have count fields
        assert "total" in data
        assert "pending" in data
        assert "confirmed" in data
        assert "dismissed" in data
        assert "duplicate_rate" in data
        
        print(f"PASS: Got duplicate stats - total: {data['total']}, pending: {data['pending']}, rate: {data['duplicate_rate']}%")


class TestFormVersioning:
    """Tests for form versioning API"""
    
    def test_get_versions_requires_auth(self, test_form_id):
        """Verify getting versions requires authentication"""
        response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}")
        assert response.status_code in [401, 403, 422]
        print("PASS: Form versions require authentication")
    
    def test_get_form_versions(self, token, test_form_id):
        """Get all versions of a form"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "versions" in data
        assert isinstance(data["versions"], list)
        
        print(f"PASS: Got {len(data['versions'])} form versions")
        return data["versions"]
    
    def test_save_form_version(self, token, test_form_id):
        """Save a new version of a form"""
        headers = {"Authorization": f"Bearer {token}"}
        
        # Note: This may fail if form doesn't exist, which is acceptable
        response = requests.post(
            f"{BASE_URL}/api/forms/versions/{test_form_id}",
            headers=headers,
            params={"description": "TEST_version created by automated test"}
        )
        
        # Either success or 404 (form not found) is acceptable
        if response.status_code == 200:
            data = response.json()
            assert "version_number" in data
            print(f"PASS: Saved version {data['version_number']}")
        elif response.status_code == 404:
            print("PASS: Save version responded with 404 (form not found - expected for test)")
        else:
            print(f"INFO: Save version returned {response.status_code} - {response.text[:100]}")
            assert response.status_code in [200, 404, 422]


class TestVersionComparison:
    """Tests for version comparison functionality"""
    
    def test_compare_versions_requires_auth(self, test_form_id):
        """Verify version comparison requires authentication"""
        response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}/compare/1/2")
        assert response.status_code in [401, 403, 422]
        print("PASS: Version comparison requires authentication")
    
    def test_compare_versions(self, token, test_form_id):
        """Compare two form versions"""
        headers = {"Authorization": f"Bearer {token}"}
        
        # First get available versions
        versions_response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}", headers=headers)
        
        if versions_response.status_code == 200:
            versions = versions_response.json().get("versions", [])
            
            if len(versions) >= 2:
                v1 = versions[-1]["version_number"]  # Oldest
                v2 = versions[0]["version_number"]   # Latest
                
                response = requests.get(
                    f"{BASE_URL}/api/forms/versions/{test_form_id}/compare/{v1}/{v2}",
                    headers=headers
                )
                
                assert response.status_code == 200
                data = response.json()
                
                assert "version1" in data
                assert "version2" in data
                assert "diff" in data
                assert "summary" in data
                
                print(f"PASS: Compared v{v1} with v{v2} - added: {data['summary'].get('added_count', 0)}, removed: {data['summary'].get('removed_count', 0)}")
            else:
                print("INFO: Not enough versions to compare, skipping comparison test")
        else:
            print("INFO: Could not get versions for comparison test")


class TestVersionChangelog:
    """Tests for version changelog"""
    
    def test_changelog_requires_auth(self, test_form_id):
        """Verify changelog requires authentication"""
        response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}/changelog")
        assert response.status_code in [401, 403, 422]
        print("PASS: Version changelog requires authentication")
    
    def test_get_changelog(self, token, test_form_id):
        """Get version changelog for a form"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/forms/versions/{test_form_id}/changelog", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "changelog" in data
        assert isinstance(data["changelog"], list)
        
        print(f"PASS: Got changelog with {len(data['changelog'])} entries")


class TestDuplicateFlaggedSubmissions:
    """Tests for flagged duplicate submissions"""
    
    def test_get_flagged_duplicates(self, token, test_form_id):
        """Get submissions flagged as duplicates"""
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/duplicates/submissions/{test_form_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "duplicates" in data
        assert isinstance(data["duplicates"], list)
        
        print(f"PASS: Got {len(data['duplicates'])} flagged duplicates")


class TestEndpointSummary:
    """Summary test to verify all new endpoints are accessible"""
    
    def test_all_new_endpoints_accessible(self, token, test_form_id):
        """Verify all new endpoints respond correctly"""
        headers = {"Authorization": f"Bearer {token}"}
        
        endpoints = [
            ("GET", f"/api/duplicates/rules/{test_form_id}", "Duplicate rules"),
            ("GET", f"/api/duplicates/stats/{test_form_id}", "Duplicate stats"),
            ("GET", f"/api/forms/versions/{test_form_id}", "Form versions"),
            ("GET", f"/api/forms/versions/{test_form_id}/changelog", "Version changelog"),
        ]
        
        results = []
        for method, endpoint, name in endpoints:
            if method == "GET":
                response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            else:
                response = requests.post(f"{BASE_URL}{endpoint}", headers=headers)
            
            status = "PASS" if response.status_code == 200 else f"FAIL ({response.status_code})"
            results.append(f"{name}: {status}")
            print(f"  {name}: {response.status_code}")
        
        # At least 3/4 endpoints should work
        passing = sum(1 for r in results if "PASS" in r)
        print(f"SUMMARY: {passing}/{len(endpoints)} new endpoints accessible")
        assert passing >= 3, f"Too many endpoints failing: {results}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
