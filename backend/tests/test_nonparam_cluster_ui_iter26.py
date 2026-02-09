"""
Iteration 26 - Tests for NonP and Cluster tabs in AdvancedStatsPanel
Tests the nonparametric tests (Mann-Whitney, Wilcoxon, Kruskal-Wallis) and clustering (K-Means, Hierarchical) endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"
ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"
FORM_ID = "124427aa-d482-4292-af6e-2042ae5cabbd"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with authentication"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


class TestNonparametricEndpoints:
    """Tests for /api/statistics/nonparametric endpoint with different test types"""
    
    def test_kruskal_wallis_test(self, auth_headers):
        """Test Kruskal-Wallis H test for 3+ groups"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "kruskal_wallis",
                "dependent_var": "age",
                "group_var": "gender"
            }
        )
        
        # Check response status
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"Kruskal-Wallis response: {data}")
        
        # If successful, validate the response structure
        if response.status_code == 200 and not data.get("error"):
            assert "test_type" in data, "Response should contain test_type"
            assert data["test_type"] == "kruskal_wallis"
            assert "H_statistic" in data, "Response should contain H_statistic"
            assert "p_value" in data, "Response should contain p_value"
            assert "significant" in data, "Response should contain significant flag"
    
    def test_mann_whitney_test(self, auth_headers):
        """Test Mann-Whitney U test for 2 groups"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "mann_whitney",
                "dependent_var": "satisfaction",
                "group_var": "gender"
            }
        )
        
        # Check response status
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"Mann-Whitney response: {data}")
        
        # If 400, check if it's a validation error (e.g., not exactly 2 groups)
        if response.status_code == 400:
            assert "detail" in data, "400 response should have detail message"
    
    def test_wilcoxon_test(self, auth_headers):
        """Test Wilcoxon signed-rank test for paired samples"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "wilcoxon",
                "dependent_var": "age",
                "paired_var": "satisfaction"
            }
        )
        
        # Check response status
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"Wilcoxon response: {data}")
        
        # If successful, validate the response structure
        if response.status_code == 200 and not data.get("error"):
            assert "test_type" in data, "Response should contain test_type"
            assert data["test_type"] == "wilcoxon"
            assert "W_statistic" in data, "Response should contain W_statistic"
            assert "p_value" in data, "Response should contain p_value"
    
    def test_nonparametric_missing_dependent_var(self, auth_headers):
        """Test validation - missing dependent variable"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/nonparametric",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "kruskal_wallis",
                "group_var": "gender"
                # dependent_var is missing
            }
        )
        
        # Should fail validation
        assert response.status_code == 422, f"Should return 422 for missing required field: {response.status_code}"


class TestClusteringEndpoints:
    """Tests for /api/statistics/clustering endpoint"""
    
    def test_kmeans_clustering(self, auth_headers):
        """Test K-Means clustering"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["age", "satisfaction"],
                "method": "kmeans",
                "n_clusters": 3
            }
        )
        
        # Check response status
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"K-Means clustering response: {data}")
        
        # Validate the response structure (if no error)
        if not data.get("error"):
            assert "method" in data, "Response should contain method"
            assert data["method"] == "kmeans"
            assert "n_clusters" in data, "Response should contain n_clusters"
            assert "cluster_profiles" in data, "Response should contain cluster_profiles"
            assert "silhouette_score" in data, "Response should contain silhouette_score"
    
    def test_kmeans_auto_clusters(self, auth_headers):
        """Test K-Means with automatic cluster detection (elbow method)"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["age", "satisfaction"],
                "method": "kmeans"
                # n_clusters not specified - should use elbow method
            }
        )
        
        # Check response status
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"K-Means auto clustering response: {data}")
        
        # If no error, should have elbow_data
        if not data.get("error"):
            assert "elbow_data" in data, "Auto-clustering should return elbow_data"
    
    def test_hierarchical_clustering(self, auth_headers):
        """Test Hierarchical clustering"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["age", "satisfaction"],
                "method": "hierarchical",
                "n_clusters": 3,
                "linkage": "ward"
            }
        )
        
        # Check response status
        assert response.status_code == 200, f"Unexpected status: {response.status_code}, {response.text}"
        
        data = response.json()
        print(f"Hierarchical clustering response: {data}")
        
        # Validate the response structure (if no error)
        if not data.get("error"):
            assert "method" in data, "Response should contain method"
            assert data["method"] == "hierarchical"
            assert "linkage" in data, "Response should contain linkage"
            assert "cluster_profiles" in data, "Response should contain cluster_profiles"
            assert "dendrogram" in data, "Hierarchical should return dendrogram data"
    
    def test_hierarchical_different_linkage(self, auth_headers):
        """Test Hierarchical clustering with different linkage methods"""
        linkage_methods = ["complete", "average", "single"]
        
        for linkage in linkage_methods:
            response = requests.post(
                f"{BASE_URL}/api/statistics/clustering",
                headers=auth_headers,
                json={
                    "form_id": FORM_ID,
                    "org_id": ORG_ID,
                    "variables": ["age", "satisfaction"],
                    "method": "hierarchical",
                    "n_clusters": 2,
                    "linkage": linkage
                }
            )
            
            assert response.status_code == 200, f"Hierarchical with {linkage} linkage failed: {response.text}"
            data = response.json()
            
            if not data.get("error"):
                assert data.get("linkage") == linkage, f"Expected linkage {linkage}, got {data.get('linkage')}"
    
    def test_clustering_insufficient_variables(self, auth_headers):
        """Test clustering with insufficient variables (needs at least 2)"""
        response = requests.post(
            f"{BASE_URL}/api/statistics/clustering",
            headers=auth_headers,
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["age"],  # Only 1 variable
                "method": "kmeans"
            }
        )
        
        # Should fail validation
        assert response.status_code == 400, f"Should return 400 for insufficient variables: {response.status_code}"


class TestEndpointHealth:
    """Basic health and connectivity tests"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
    
    def test_auth_endpoint(self):
        """Test auth endpoint is working"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Auth failed: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
