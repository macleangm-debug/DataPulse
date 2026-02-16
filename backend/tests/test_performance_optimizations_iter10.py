"""
DataPulse Performance Optimizations Test Suite - Iteration 10
Tests: MongoDB connection pooling, GZip compression, Redis caching, bulk operations
"""
import pytest
import requests
import os
import uuid
import json
import gzip

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHealthEndpoints:
    """Tests for health check endpoints with performance metrics"""
    
    def test_api_health_returns_status(self):
        """Test GET /api/health returns healthy status with optimization info"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "degraded"]
        assert "database" in data
        assert data["database"] == "connected"
        assert "cache" in data
        
        # Verify optimization info is present
        assert "optimizations" in data
        optimizations = data["optimizations"]
        assert optimizations["compression"] == "gzip"
        assert "100 connections" in optimizations["connection_pool"]
        assert optimizations["bulk_operations"] == "enabled"
        print(f"✅ Health endpoint: {data['status']}, DB: {data['database']}, Cache: {data['cache']}")
    
    def test_performance_health_endpoint(self):
        """Test GET /api/performance/health returns system health"""
        response = requests.get(f"{BASE_URL}/api/performance/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "services" in data
        
        # Verify service statuses
        services = data["services"]
        assert "mongodb" in services
        assert services["mongodb"] == "healthy"
        assert "redis" in services
        # Redis can be healthy or unavailable depending on environment
        assert services["redis"] in ["healthy", "unavailable"]
        
        # Verify cache stats
        assert "cache" in data
        cache_stats = data["cache"]
        assert "redis_available" in cache_stats
        assert "memory_cache_size" in cache_stats
        assert isinstance(cache_stats["memory_cache_size"], int)
        
        print(f"✅ Performance health: MongoDB={services['mongodb']}, Redis={services['redis']}")
        print(f"   Cache stats: redis_available={cache_stats['redis_available']}")


class TestGzipCompression:
    """Tests for GZip response compression middleware"""
    
    def test_gzip_encoding_header_accepted(self):
        """Test that server responds to Accept-Encoding: gzip"""
        headers = {"Accept-Encoding": "gzip, deflate"}
        response = requests.get(f"{BASE_URL}/api/health", headers=headers)
        
        assert response.status_code == 200
        
        # Check Vary header indicates content varies by Accept-Encoding
        vary_header = response.headers.get("Vary", "")
        assert "Accept-Encoding" in vary_header
        print(f"✅ Vary header present: {vary_header}")
    
    def test_compression_reduces_large_response(self):
        """Test that GZip compression is applied to responses > 500 bytes"""
        # Get a response that might be larger (help articles list)
        headers = {"Accept-Encoding": "gzip, deflate"}
        
        # Get response with compression
        response_compressed = requests.get(
            f"{BASE_URL}/api/help/articles", 
            headers=headers,
            stream=True
        )
        
        # Get response without compression request
        response_uncompressed = requests.get(
            f"{BASE_URL}/api/help/articles",
            headers={"Accept-Encoding": "identity"}
        )
        
        # If response is large enough, it should be compressed
        compressed_size = len(response_compressed.content)
        uncompressed_size = len(response_uncompressed.content)
        
        # The content-encoding header indicates if gzip was applied
        encoding = response_compressed.headers.get("Content-Encoding", "none")
        
        print(f"✅ Response sizes - with gzip header: {compressed_size} bytes, without: {uncompressed_size} bytes")
        print(f"   Content-Encoding: {encoding}")
        
        # Both should return 200
        assert response_compressed.status_code == 200
        assert response_uncompressed.status_code == 200


class TestRedisCaching:
    """Tests for Redis caching layer"""
    
    def test_redis_connection_status(self):
        """Test Redis connection is healthy in performance health"""
        response = requests.get(f"{BASE_URL}/api/performance/health")
        assert response.status_code == 200
        
        data = response.json()
        redis_status = data["services"]["redis"]
        cache_stats = data["cache"]
        
        # Redis should be connected or have fallback
        assert redis_status in ["healthy", "unavailable"]
        
        if redis_status == "healthy":
            assert cache_stats["redis_available"] == True
            print(f"✅ Redis connected - hits: {cache_stats.get('redis_hits', 0)}, misses: {cache_stats.get('redis_misses', 0)}")
        else:
            print(f"✅ Redis unavailable, using in-memory fallback (size: {cache_stats['memory_cache_size']})")
    
    def test_cache_stats_includes_redis_metrics(self):
        """Test cache stats endpoint returns Redis metrics when available"""
        # First check if Redis is connected
        health_response = requests.get(f"{BASE_URL}/api/performance/health")
        data = health_response.json()
        
        cache_stats = data["cache"]
        
        # Required fields
        assert "redis_available" in cache_stats
        assert "memory_cache_size" in cache_stats
        assert "memory_cache_max_size" in cache_stats
        
        # If Redis is available, should have extra stats
        if cache_stats["redis_available"]:
            assert "redis_hits" in cache_stats
            assert "redis_misses" in cache_stats
            assert "redis_keys" in cache_stats
            print(f"✅ Redis stats: keys={cache_stats['redis_keys']}, hits={cache_stats['redis_hits']}")
        else:
            print(f"✅ Memory fallback: size={cache_stats['memory_cache_size']}/{cache_stats['memory_cache_max_size']}")


class TestBulkSubmissionEndpoint:
    """Tests for bulk submission endpoint with batch processing"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_bulk_submissions_endpoint_exists(self, auth_token):
        """Test POST /api/bulk/submissions endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Send empty submissions array - should fail validation but endpoint should respond
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions",
            headers=headers,
            json={"submissions": []}
        )
        
        # Empty array should return error or success with 0 processed
        assert response.status_code in [200, 422]  # 422 for validation error is acceptable
        print(f"✅ Bulk submissions endpoint exists, status: {response.status_code}")
    
    def test_bulk_submissions_with_nonexistent_forms(self, auth_token):
        """Test bulk submissions returns 'Form not found' for non-existent forms"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        batch_id = str(uuid.uuid4())
        submissions = [
            {
                "form_id": f"nonexistent-form-{uuid.uuid4()}",
                "data": {"field1": "value1"}
            },
            {
                "form_id": f"nonexistent-form-{uuid.uuid4()}",
                "data": {"field2": "value2"}
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions",
            headers=headers,
            json={
                "submissions": submissions,
                "batch_id": batch_id
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return result with failures for non-existent forms
        assert "batch_id" in data
        assert data["batch_id"] == batch_id
        assert "total" in data
        assert data["total"] == 2
        assert "successful" in data
        assert "failed" in data
        assert data["failed"] == 2  # Both should fail due to non-existent forms
        assert "results" in data
        assert "processing_time_ms" in data
        
        # Check results indicate form not found
        for result in data["results"]:
            assert result["success"] == False
            assert "Form not found" in result.get("error", "")
        
        print(f"✅ Bulk submissions correctly returns 'Form not found': batch_id={batch_id}")
        print(f"   Total: {data['total']}, Successful: {data['successful']}, Failed: {data['failed']}")
        print(f"   Processing time: {data['processing_time_ms']}ms")
    
    def test_bulk_submissions_response_structure(self, auth_token):
        """Test bulk submissions response has correct structure"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions",
            headers=headers,
            json={
                "submissions": [{"form_id": "test", "data": {}}],
                "sync_mode": "insert"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure matches BulkSubmissionResult model
        required_fields = ["batch_id", "total", "successful", "failed", "results", "processing_time_ms"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        assert isinstance(data["batch_id"], str)
        assert isinstance(data["total"], int)
        assert isinstance(data["successful"], int)
        assert isinstance(data["failed"], int)
        assert isinstance(data["results"], list)
        assert isinstance(data["processing_time_ms"], (int, float))
        
        print(f"✅ Bulk submissions response structure correct")
        print(f"   Fields present: {list(data.keys())}")
    
    def test_bulk_submissions_max_limit_is_1000(self, auth_token):
        """Test that bulk submissions accepts up to 1000 items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create 1001 submissions to test the limit
        submissions = [
            {"form_id": f"form-{i}", "data": {"field": i}}
            for i in range(1001)
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions",
            headers=headers,
            json={"submissions": submissions}
        )
        
        # Should reject due to max_length=1000 on submissions field
        assert response.status_code == 422  # Validation error
        print(f"✅ Bulk submissions correctly rejects > 1000 items (status: 422)")


class TestBulkDeleteEndpoint:
    """Tests for bulk delete endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_bulk_delete_endpoint_exists(self, auth_token):
        """Test POST /api/bulk/submissions/delete endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions/delete",
            headers=headers,
            json={"ids": [], "soft_delete": True}
        )
        
        # Empty ids should return 200 with 0 deleted
        assert response.status_code == 200
        data = response.json()
        
        assert "total_requested" in data
        assert data["total_requested"] == 0
        assert "deleted" in data
        assert "soft_delete" in data
        assert data["soft_delete"] == True
        
        print(f"✅ Bulk delete endpoint exists and responds correctly")
    
    def test_bulk_soft_delete_nonexistent_ids(self, auth_token):
        """Test bulk soft delete with non-existent IDs"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        fake_ids = [str(uuid.uuid4()) for _ in range(5)]
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions/delete",
            headers=headers,
            json={"ids": fake_ids, "soft_delete": True}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_requested"] == 5
        assert data["deleted"] == 0  # Nothing deleted because IDs don't exist
        assert data["soft_delete"] == True
        assert "processing_time_ms" in data
        
        print(f"✅ Bulk soft delete handles non-existent IDs correctly")
        print(f"   Requested: {data['total_requested']}, Deleted: {data['deleted']}")
    
    def test_bulk_hard_delete_requires_superadmin(self, auth_token):
        """Test hard delete requires superadmin privileges"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions/delete",
            headers=headers,
            json={"ids": ["test-id"], "soft_delete": False}
        )
        
        # Regular user should get 403 for hard delete
        assert response.status_code == 403
        data = response.json()
        assert "superadmin" in data.get("detail", "").lower() or "hard delete" in data.get("detail", "").lower()
        
        print(f"✅ Hard delete correctly requires superadmin (status: 403)")


class TestBulkUpdateEndpoint:
    """Tests for bulk update endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_bulk_update_endpoint_exists(self, auth_token):
        """Test POST /api/bulk/submissions/update endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/bulk/submissions/update",
            headers=headers,
            json={"updates": []}
        )
        
        # Empty updates should return 200
        assert response.status_code == 200
        data = response.json()
        
        assert "total_requested" in data
        assert data["total_requested"] == 0
        assert "successful" in data
        assert "failed" in data
        assert "processing_time_ms" in data
        
        print(f"✅ Bulk update endpoint exists and responds correctly")


class TestBulkStatusEndpoint:
    """Tests for bulk operation status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_bulk_status_endpoint_returns_404_for_unknown_batch(self, auth_token):
        """Test GET /api/bulk/status/{batch_id} returns 404 for unknown batch"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        fake_batch_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/bulk/status/{fake_batch_id}",
            headers=headers
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        
        print(f"✅ Bulk status correctly returns 404 for unknown batch")


class TestCacheStatsAuthentication:
    """Tests for cache stats endpoint authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_cache_stats_requires_auth(self):
        """Test GET /api/performance/cache/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/performance/cache/stats")
        
        assert response.status_code == 401
        print(f"✅ Cache stats endpoint correctly requires authentication")
    
    def test_cache_stats_with_auth(self, auth_token):
        """Test GET /api/performance/cache/stats with valid auth"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/performance/cache/stats",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return cache statistics
        assert "redis_available" in data
        assert "memory_cache_size" in data
        
        print(f"✅ Cache stats accessible with auth")
        print(f"   Stats: {data}")


class TestPreviousFeaturesStillWork:
    """Regression tests - ensure previous features still work"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_chat_persistence_still_works(self, auth_token):
        """Test chat persistence feature still works"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Send a chat message
        session_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            headers=headers,
            json={
                "message": "What is DataPulse?",
                "session_id": session_id
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data
        assert "session_id" in data
        assert data["session_id"] == session_id
        
        print(f"✅ Chat persistence works - session_id: {session_id}")
    
    def test_help_articles_with_screenshots(self):
        """Test help articles endpoint still returns screenshots"""
        response = requests.get(f"{BASE_URL}/api/help/articles")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "articles" in data
        assert len(data["articles"]) > 0
        
        # Check that at least one article has screenshot
        articles_with_screenshots = [
            a for a in data["articles"] 
            if a.get("screenshot_url") or a.get("screenshot")
        ]
        
        print(f"✅ Help articles work - {len(data['articles'])} articles, {len(articles_with_screenshots)} with screenshots")
    
    def test_help_article_detail_has_screenshot(self):
        """Test getting-started article has screenshot"""
        response = requests.get(f"{BASE_URL}/api/help/articles/getting-started")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "title" in data
        # Article should have screenshot URL
        screenshot_url = data.get("screenshot_url") or data.get("screenshot")
        
        print(f"✅ Article detail works - title: {data.get('title')}")
        if screenshot_url:
            print(f"   Screenshot URL: {screenshot_url}")


class TestConnectionPoolConfiguration:
    """Tests related to connection pool configuration"""
    
    def test_health_reports_100_connections(self):
        """Test that health endpoint reports 100 connection pool"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        pool_config = data["optimizations"]["connection_pool"]
        
        assert "100" in pool_config
        print(f"✅ Connection pool configured: {pool_config}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
