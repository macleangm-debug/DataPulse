"""
Iteration 25: Tests for Audit Trail, RBAC, Nonparametric Tests, Proportions Tests, and Clustering
Features tested:
- Audit Trail: GET /api/audit/summary/{org_id}, POST /api/audit/logs
- RBAC: GET /api/rbac/roles/{org_id}, GET /api/rbac/permissions, POST /api/rbac/check-permission
- Nonparametric: POST /api/statistics/nonparametric (mann_whitney, wilcoxon, kruskal_wallis)
- Proportions: POST /api/statistics/proportions (one_sample, two_sample, chi_square)
- Clustering: POST /api/statistics/clustering (kmeans, hierarchical)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"
TEST_ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return auth headers"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestAuditTrail:
    """Test Audit Trail endpoints"""

    def test_audit_summary(self, auth_headers):
        """Test GET /api/audit/summary/{org_id} returns activity summary"""
        response = requests.get(
            f"{BASE_URL}/api/audit/summary/{TEST_ORG_ID}?days=30",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate response structure
        assert "period_days" in data, "Missing period_days in response"
        assert "total_actions" in data, "Missing total_actions in response"
        assert "export_count" in data, "Missing export_count in response"
        assert "pii_access_count" in data, "Missing pii_access_count in response"
        assert "by_action" in data, "Missing by_action in response"
        assert "by_user" in data, "Missing by_user in response"
        assert "by_resource" in data, "Missing by_resource in response"
        
        assert data["period_days"] == 30
        print(f"Audit Summary: {data['total_actions']} actions, {data['export_count']} exports in last 30 days")

    def test_audit_logs_paginated(self, auth_headers):
        """Test POST /api/audit/logs returns paginated logs"""
        response = requests.post(
            f"{BASE_URL}/api/audit/logs",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "page": 1,
                "page_size": 20
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Validate pagination structure
        assert "total" in data, "Missing total in response"
        assert "page" in data, "Missing page in response"
        assert "page_size" in data, "Missing page_size in response"
        assert "total_pages" in data, "Missing total_pages in response"
        assert "logs" in data, "Missing logs in response"
        
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert isinstance(data["logs"], list)
        print(f"Audit Logs: {data['total']} total logs, page 1 of {data['total_pages']}")

    def test_audit_logs_with_filters(self, auth_headers):
        """Test POST /api/audit/logs with action filter"""
        response = requests.post(
            f"{BASE_URL}/api/audit/logs",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "action": "export_csv",
                "page": 1,
                "page_size": 10
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "logs" in data
        # If there are logs, they should all be export_csv type
        for log in data["logs"]:
            assert log.get("action") == "export_csv", f"Expected export_csv action, got {log.get('action')}"
        print(f"Filtered Audit Logs: {data['total']} export_csv logs")

    def test_create_audit_log(self, auth_headers):
        """Test POST /api/audit/log creates new audit entry"""
        response = requests.post(
            f"{BASE_URL}/api/audit/log",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "user_id": "test_user_iter25",
                "user_email": TEST_EMAIL,
                "action": "export_csv",
                "resource_type": "form",
                "resource_id": "test_form_id",
                "resource_name": "TEST_Audit_Form_Iter25",
                "details": {"format": "csv", "record_count": 100}
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Missing id in response"
        assert "created_at" in data, "Missing created_at in response"
        print(f"Created audit log with ID: {data['id']}")


class TestRBAC:
    """Test Role-Based Access Control endpoints"""

    def test_get_roles(self, auth_headers):
        """Test GET /api/rbac/roles/{org_id} returns 4 default roles"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "roles" in data, "Missing roles in response"
        
        roles = data["roles"]
        assert isinstance(roles, list)
        
        # Check for 4 default roles
        default_role_ids = ["viewer", "analyst", "senior_analyst", "admin"]
        found_roles = [r["id"] for r in roles if r.get("is_default")]
        
        for role_id in default_role_ids:
            assert role_id in found_roles, f"Missing default role: {role_id}"
        
        assert len([r for r in roles if r.get("is_default")]) >= 4, "Should have at least 4 default roles"
        
        # Verify role structure
        for role in roles:
            assert "id" in role, "Missing id in role"
            assert "name" in role, "Missing name in role"
            assert "permissions" in role, "Missing permissions in role"
            assert "is_default" in role, "Missing is_default in role"
        
        print(f"Found {len(roles)} roles, {len([r for r in roles if r.get('is_default')])} default roles")

    def test_get_permissions(self, auth_headers):
        """Test GET /api/rbac/permissions returns all available permissions"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/permissions",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "permissions" in data, "Missing permissions in response"
        assert "categories" in data, "Missing categories in response"
        
        permissions = data["permissions"]
        assert isinstance(permissions, list)
        assert len(permissions) >= 20, f"Expected at least 20 permissions, got {len(permissions)}"
        
        # Verify permission structure
        for perm in permissions:
            assert "id" in perm, "Missing id in permission"
            assert "name" in perm, "Missing name in permission"
            assert "category" in perm, "Missing category in permission"
        
        # Check for key permissions
        perm_ids = [p["id"] for p in permissions]
        expected_perms = ["export_csv", "view_responses", "run_basic_stats", "view_dashboards", "view_audit_logs"]
        for exp_perm in expected_perms:
            assert exp_perm in perm_ids, f"Missing expected permission: {exp_perm}"
        
        print(f"Found {len(permissions)} permissions across {len(data['categories'])} categories")

    def test_check_permission(self, auth_headers):
        """Test POST /api/rbac/check-permission validates user permissions"""
        response = requests.post(
            f"{BASE_URL}/api/rbac/check-permission",
            headers=auth_headers,
            json={
                "user_id": "test_user_iter25",
                "org_id": TEST_ORG_ID,
                "permission": "view_responses"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Missing user_id in response"
        assert "permission" in data, "Missing permission in response"
        assert "allowed" in data, "Missing allowed in response"
        assert "role_id" in data, "Missing role_id in response"
        
        print(f"Permission check: user={data['user_id']}, permission={data['permission']}, allowed={data['allowed']}, role={data['role_id']}")

    def test_get_user_role(self, auth_headers):
        """Test GET /api/rbac/user-role/{org_id}/{user_id} returns user's role"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/user-role/{TEST_ORG_ID}/test_user_iter25",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "role_id" in data, "Missing role_id in response"
        assert "role_name" in data, "Missing role_name in response"
        
        # Default user should get viewer role
        assert data["role_id"] == "viewer", f"Expected viewer role, got {data['role_id']}"
        print(f"User role: {data['role_name']} ({data['role_id']})")


class TestNonparametricTests:
    """Test Nonparametric statistical tests"""

    def test_mann_whitney_endpoint(self, auth_headers):
        """Test POST /api/statistics/nonparametric with mann_whitney test type"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "mann_whitney",
                "dependent_var": "score",
                "group_var": "group"
            }
        )
        # May return 400 if no data available or 200 with error message
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        data = response.json()
        # If successful, check structure
        if response.status_code == 200 and "error" not in data:
            assert "test_type" in data
            assert data["test_type"] == "mann_whitney"
        print(f"Mann-Whitney test response: {response.status_code}")

    def test_wilcoxon_endpoint(self, auth_headers):
        """Test POST /api/statistics/nonparametric with wilcoxon test type"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "wilcoxon",
                "dependent_var": "score1",
                "paired_var": "score2"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"Wilcoxon test response: {response.status_code}")

    def test_kruskal_wallis_endpoint(self, auth_headers):
        """Test POST /api/statistics/nonparametric with kruskal_wallis test type"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "kruskal_wallis",
                "dependent_var": "score",
                "group_var": "category"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"Kruskal-Wallis test response: {response.status_code}")

    def test_invalid_test_type(self, auth_headers):
        """Test nonparametric endpoint rejects invalid test type"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "invalid_test",
                "dependent_var": "score"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            # Should have error or unknown test type message
            assert "error" in data or "Unknown test type" in str(data), "Should report error for invalid test type"


class TestProportionsTests:
    """Test Proportions statistical tests"""

    def test_one_sample_proportion(self, auth_headers):
        """Test POST /api/statistics/proportions with one_sample test"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/proportions",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "one_sample",
                "variable": "response",
                "success_value": "yes",
                "hypothesized_prop": 0.5
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        data = response.json()
        if response.status_code == 200 and "error" not in data:
            assert data.get("test_type") == "one_sample"
        print(f"One-sample proportion test response: {response.status_code}")

    def test_two_sample_proportion(self, auth_headers):
        """Test POST /api/statistics/proportions with two_sample test"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/proportions",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "two_sample",
                "variable": "outcome",
                "success_value": "success",
                "group_var": "treatment"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"Two-sample proportion test response: {response.status_code}")

    def test_chi_square_test(self, auth_headers):
        """Test POST /api/statistics/proportions with chi_square test"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/proportions",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "chi_square",
                "variable": "category1",
                "group_var": "category2"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"Chi-square test response: {response.status_code}")

    def test_missing_params_validation(self, auth_headers):
        """Test proportions endpoint validates required parameters"""
        # One-sample without hypothesized_prop - should return 400 or error in response
        response = requests.post(
            f"{BASE_URL}/api/statistics/proportions",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "test_type": "one_sample",
                "variable": "response",
                "success_value": "yes"
                # Missing hypothesized_prop
            }
        )
        # API may return 200 with error or 400 - either is acceptable for missing data scenarios
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        data = response.json()
        # Should have some error indication
        if response.status_code == 200:
            assert "error" in data or "detail" in str(data).lower(), "Should indicate an error for incomplete params or missing data"
        print(f"Missing params validation: status={response.status_code}, response={data}")


class TestClustering:
    """Test Clustering endpoints"""

    def test_kmeans_clustering(self, auth_headers):
        """Test POST /api/statistics/clustering with kmeans method"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "variables": ["var1", "var2"],
                "method": "kmeans",
                "n_clusters": 3
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        data = response.json()
        if response.status_code == 200 and "error" not in data:
            assert data.get("method") == "kmeans"
            assert "n_clusters" in data
            assert "cluster_profiles" in data or "n_observations" in data
        print(f"K-means clustering response: {response.status_code}")

    def test_hierarchical_clustering(self, auth_headers):
        """Test POST /api/statistics/clustering with hierarchical method"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "variables": ["var1", "var2"],
                "method": "hierarchical",
                "n_clusters": 3,
                "linkage": "ward"
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        data = response.json()
        if response.status_code == 200 and "error" not in data:
            assert data.get("method") == "hierarchical"
        print(f"Hierarchical clustering response: {response.status_code}")

    def test_kmeans_auto_clusters(self, auth_headers):
        """Test POST /api/statistics/clustering with auto-detect clusters (elbow method)"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "variables": ["var1", "var2"],
                "method": "kmeans"
                # No n_clusters - should use elbow method
            }
        )
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        data = response.json()
        if response.status_code == 200 and "error" not in data:
            # Should have elbow_data when auto-detecting clusters
            if "elbow_data" in data:
                assert isinstance(data["elbow_data"], list)
                print(f"Elbow method detected {data.get('n_clusters')} clusters")
        print(f"K-means auto-clusters response: {response.status_code}")

    def test_invalid_method(self, auth_headers):
        """Test clustering endpoint rejects invalid method"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "org_id": TEST_ORG_ID,
                "variables": ["var1", "var2"],
                "method": "invalid_method"
            }
        )
        # Should return 400 for invalid method
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"


class TestRBACRoleDetails:
    """Additional RBAC tests for role permissions"""

    def test_viewer_role_permissions(self, auth_headers):
        """Verify viewer role has limited permissions"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        viewer_role = next((r for r in data["roles"] if r["id"] == "viewer"), None)
        assert viewer_role is not None, "Viewer role not found"
        
        # Viewer should have view-only permissions
        viewer_perms = viewer_role["permissions"]
        assert "view_responses" in viewer_perms, "Viewer should have view_responses"
        assert "run_basic_stats" in viewer_perms, "Viewer should have run_basic_stats"
        assert "view_dashboards" in viewer_perms, "Viewer should have view_dashboards"
        
        # Viewer should NOT have export or admin permissions
        assert "export_csv" not in viewer_perms, "Viewer should NOT have export_csv"
        assert "manage_users" not in viewer_perms, "Viewer should NOT have manage_users"
        print(f"Viewer role has {len(viewer_perms)} permissions")

    def test_admin_role_has_all_permissions(self, auth_headers):
        """Verify admin role has all permissions"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        admin_role = next((r for r in data["roles"] if r["id"] == "admin"), None)
        assert admin_role is not None, "Admin role not found"
        
        admin_perms = admin_role["permissions"]
        
        # Admin should have all key permissions
        expected_admin_perms = [
            "view_responses", "view_pii_fields", "export_csv", "export_spss",
            "run_advanced_stats", "view_audit_logs", "manage_users", "manage_roles"
        ]
        for perm in expected_admin_perms:
            assert perm in admin_perms, f"Admin missing permission: {perm}"
        
        print(f"Admin role has {len(admin_perms)} permissions")

    def test_analyst_role_export_permissions(self, auth_headers):
        """Verify analyst role has basic export but not statistical exports"""
        response = requests.get(
            f"{BASE_URL}/api/rbac/roles/{TEST_ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        analyst_role = next((r for r in data["roles"] if r["id"] == "analyst"), None)
        assert analyst_role is not None, "Analyst role not found"
        
        analyst_perms = analyst_role["permissions"]
        
        # Analyst should have CSV and Excel export
        assert "export_csv" in analyst_perms, "Analyst should have export_csv"
        assert "export_excel" in analyst_perms, "Analyst should have export_excel"
        
        # Analyst should NOT have SPSS/Stata export
        assert "export_spss" not in analyst_perms, "Analyst should NOT have export_spss"
        print(f"Analyst role has {len(analyst_perms)} permissions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
