"""
Test suite for Iteration 10 features:
- API Security (API Keys, Rate Limits, Audit Logs, Security Settings)
- Super Admin Dashboard (Organizations, Billing Plans, Alerts, Invoices)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stats-preview-fix.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "test@datapulse.io"
TEST_PASSWORD = "password123"


# Module level fixtures
@pytest.fixture(scope="module")
def auth_data():
    """Get auth token and org_id for all tests"""
    # Login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get("access_token")
    
    # Get headers
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Super-Admin": "true"
    }
    
    # Get org_id
    response = requests.get(f"{BASE_URL}/api/organizations", headers=headers)
    assert response.status_code == 200, f"Get orgs failed: {response.text}"
    orgs = response.json()
    org_id = orgs[0].get("id") if orgs else None
    
    return {"headers": headers, "org_id": org_id, "token": token}


# ==================== SECURITY API TESTS ====================

class TestSecurityRateLimits:
    """Test Security API - Rate Limits"""

    def test_get_rate_limits_tiers(self, auth_data):
        """GET /api/security/rate-limits - Get rate limit tiers"""
        response = requests.get(
            f"{BASE_URL}/api/security/rate-limits",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get rate limits: {response.text}"
        
        data = response.json()
        assert "tiers" in data
        assert len(data["tiers"]) >= 3
        
        tier_ids = [t["id"] for t in data["tiers"]]
        assert "free" in tier_ids
        assert "pro" in tier_ids
        assert "enterprise" in tier_ids
        
        print(f"✓ Rate limit tiers: {tier_ids}")

    def test_get_rate_limit_status(self, auth_data):
        """GET /api/security/rate-limits/{org_id}/status - Get rate limit status"""
        response = requests.get(
            f"{BASE_URL}/api/security/rate-limits/{auth_data['org_id']}/status",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get rate limit status: {response.text}"
        
        data = response.json()
        assert "tier" in data
        assert "limit_per_minute" in data
        assert "current_usage" in data
        assert "reset_at" in data
        
        print(f"✓ Rate limit status: tier={data['tier']}, usage={data['current_usage']}/{data['limit_per_minute']}")


class TestSecurityAPIKeys:
    """Test Security API - API Key Management"""
    
    created_key_id = None

    def test_create_api_key(self, auth_data):
        """POST /api/security/api-keys/{org_id} - Create API key"""
        params = {
            "name": "TEST_API_Key_Iter10",
            "tier": "free"
        }
        response = requests.post(
            f"{BASE_URL}/api/security/api-keys/{auth_data['org_id']}",
            headers=auth_data["headers"],
            params=params,
            json={"scopes": ["read", "write"]}
        )
        
        assert response.status_code == 200, f"Failed to create API key: {response.text}"
        
        data = response.json()
        assert "key" in data
        assert "key_prefix" in data
        assert data["name"] == "TEST_API_Key_Iter10"
        
        TestSecurityAPIKeys.created_key_id = data.get("id")
        print(f"✓ Created API key: {data['key_prefix']}... (id: {data['id']})")

    def test_list_api_keys(self, auth_data):
        """GET /api/security/api-keys/{org_id} - List API keys"""
        response = requests.get(
            f"{BASE_URL}/api/security/api-keys/{auth_data['org_id']}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to list API keys: {response.text}"
        
        data = response.json()
        assert "keys" in data
        assert isinstance(data["keys"], list)
        print(f"✓ Found {len(data['keys'])} API keys")

    def test_delete_api_key(self, auth_data):
        """DELETE /api/security/api-keys/{org_id}/{key_id} - Delete API key"""
        if not TestSecurityAPIKeys.created_key_id:
            pytest.skip("No API key created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/security/api-keys/{auth_data['org_id']}/{TestSecurityAPIKeys.created_key_id}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to delete API key: {response.text}"
        data = response.json()
        assert data.get("message") == "API key revoked"
        print(f"✓ Deleted API key: {TestSecurityAPIKeys.created_key_id}")


class TestSecurityAuditLogs:
    """Test Security API - Audit Logs"""

    def test_get_audit_logs(self, auth_data):
        """GET /api/security/audit-logs/{org_id} - Get audit logs"""
        response = requests.get(
            f"{BASE_URL}/api/security/audit-logs/{auth_data['org_id']}",
            headers=auth_data["headers"],
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Failed to get audit logs: {response.text}"
        
        data = response.json()
        assert "logs" in data
        assert "total" in data
        print(f"✓ Found {data['total']} audit logs")

    def test_get_audit_stats(self, auth_data):
        """GET /api/security/audit-logs/{org_id}/stats - Get audit statistics"""
        response = requests.get(
            f"{BASE_URL}/api/security/audit-logs/{auth_data['org_id']}/stats",
            headers=auth_data["headers"],
            params={"days": 7}
        )
        
        assert response.status_code == 200, f"Failed to get audit stats: {response.text}"
        
        data = response.json()
        assert "daily_stats" in data
        assert "error_stats" in data
        print(f"✓ Audit stats for {data['period_days']} days")


class TestSecuritySettings:
    """Test Security API - Security Settings"""

    def test_get_security_settings(self, auth_data):
        """GET /api/security/settings/{org_id} - Get security settings"""
        response = requests.get(
            f"{BASE_URL}/api/security/settings/{auth_data['org_id']}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get security settings: {response.text}"
        
        data = response.json()
        assert "two_factor_required" in data
        assert "session_timeout_minutes" in data
        print(f"✓ Security settings: 2FA={data['two_factor_required']}, timeout={data['session_timeout_minutes']}min")

    def test_update_security_settings(self, auth_data):
        """PUT /api/security/settings/{org_id} - Update security settings"""
        response = requests.put(
            f"{BASE_URL}/api/security/settings/{auth_data['org_id']}",
            headers=auth_data["headers"],
            json={"session_timeout_minutes": 120}
        )
        
        assert response.status_code == 200, f"Failed to update security settings: {response.text}"
        data = response.json()
        assert data.get("message") == "Security settings updated"
        print("✓ Security settings updated")


class TestIPWhitelist:
    """Test Security API - IP Whitelist"""

    def test_get_ip_whitelist(self, auth_data):
        """GET /api/security/ip-whitelist/{org_id} - Get IP whitelist"""
        response = requests.get(
            f"{BASE_URL}/api/security/ip-whitelist/{auth_data['org_id']}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get IP whitelist: {response.text}"
        
        data = response.json()
        assert "ips" in data
        assert "enabled" in data
        print(f"✓ IP whitelist: enabled={data['enabled']}")


# ==================== ADMIN API TESTS ====================

class TestAdminDashboard:
    """Test Super Admin API - Dashboard"""

    def test_get_admin_dashboard(self, auth_data):
        """GET /api/admin/dashboard - Get admin dashboard stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get admin dashboard: {response.text}"
        
        data = response.json()
        assert "stats" in data
        assert "billing_distribution" in data
        
        stats = data["stats"]
        assert "total_organizations" in stats
        assert "total_users" in stats
        print(f"✓ Admin dashboard: {stats['total_organizations']} orgs, {stats['total_users']} users")


class TestAdminOrganizations:
    """Test Super Admin API - Organization Management"""

    def test_list_all_organizations(self, auth_data):
        """GET /api/admin/organizations - List all organizations"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers=auth_data["headers"],
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Failed to list organizations: {response.text}"
        
        data = response.json()
        assert "organizations" in data
        assert "total" in data
        
        if len(data["organizations"]) > 0:
            assert "usage" in data["organizations"][0]
        
        print(f"✓ Admin: Found {data['total']} organizations")

    def test_get_organization_details(self, auth_data):
        """GET /api/admin/organizations/{org_id} - Get org details"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations/{auth_data['org_id']}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get org details: {response.text}"
        
        data = response.json()
        assert "organization" in data
        assert "usage" in data
        assert "current_plan" in data
        print(f"✓ Org details: plan={data['current_plan']['name']}")


class TestAdminBillingPlans:
    """Test Super Admin API - Billing Plans"""

    def test_get_billing_plans(self, auth_data):
        """GET /api/admin/billing/plans - Get billing plans"""
        response = requests.get(
            f"{BASE_URL}/api/admin/billing/plans",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get billing plans: {response.text}"
        
        data = response.json()
        assert "plans" in data
        assert len(data["plans"]) >= 3
        
        plan_ids = [p["id"] for p in data["plans"]]
        assert "free" in plan_ids
        assert "pro" in plan_ids
        assert "enterprise" in plan_ids
        
        print(f"✓ Billing plans: free, pro, enterprise")


class TestAdminAlerts:
    """Test Super Admin API - Usage Alerts"""

    def test_get_usage_alerts(self, auth_data):
        """GET /api/admin/alerts - Get usage alerts"""
        response = requests.get(
            f"{BASE_URL}/api/admin/alerts",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get alerts: {response.text}"
        
        data = response.json()
        assert "alerts" in data
        assert "total" in data
        print(f"✓ Usage alerts: {data['total']} total")


class TestAdminInvoices:
    """Test Super Admin API - Invoice Management"""

    def test_list_invoices(self, auth_data):
        """GET /api/admin/invoices - List all invoices"""
        response = requests.get(
            f"{BASE_URL}/api/admin/invoices",
            headers=auth_data["headers"],
            params={"limit": 10}
        )
        
        assert response.status_code == 200, f"Failed to list invoices: {response.text}"
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        print(f"✓ Invoices: {data['total']} total")


class TestAdminSystemStats:
    """Test Super Admin API - System Statistics"""

    def test_get_system_stats(self, auth_data):
        """GET /api/admin/system/stats - Get system statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/stats",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Failed to get system stats: {response.text}"
        
        data = response.json()
        assert "daily_submissions" in data
        assert "daily_new_users" in data
        assert "api_calls_today" in data
        print(f"✓ System stats: {data['api_calls_today']} API calls today")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
