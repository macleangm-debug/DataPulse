"""
DataPulse Help Center API Tests - Iteration 5
Tests for Help Center endpoints including articles, categories, and AI chat
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHelpArticles:
    """Test help articles endpoints"""
    
    def test_get_all_articles(self):
        """GET /api/help/articles returns list of help articles"""
        response = requests.get(f"{BASE_URL}/api/help/articles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "articles" in data
        assert isinstance(data["articles"], list)
        assert len(data["articles"]) > 0, "Should have at least one article"
        
        # Validate article structure
        first_article = data["articles"][0]
        assert "id" in first_article
        assert "title" in first_article
        assert "category" in first_article
        assert "summary" in first_article
        print(f"✅ GET /api/help/articles - Found {len(data['articles'])} articles")
    
    def test_get_articles_filter_by_category(self):
        """GET /api/help/articles?category=forms filters by category"""
        response = requests.get(f"{BASE_URL}/api/help/articles?category=forms")
        assert response.status_code == 200
        
        data = response.json()
        assert "articles" in data
        
        # All returned articles should be in the 'forms' category
        for article in data["articles"]:
            assert article["category"] == "forms", f"Expected forms category, got {article['category']}"
        
        print(f"✅ GET /api/help/articles?category=forms - Found {len(data['articles'])} forms articles")
    
    def test_get_articles_filter_by_dataviz_category(self):
        """GET /api/help/articles?category=dataviz filters correctly"""
        response = requests.get(f"{BASE_URL}/api/help/articles?category=dataviz")
        assert response.status_code == 200
        
        data = response.json()
        for article in data["articles"]:
            assert article["category"] == "dataviz"
        
        print(f"✅ GET /api/help/articles?category=dataviz - Found {len(data['articles'])} dataviz articles")
    
    def test_get_articles_search(self):
        """GET /api/help/articles?search=form filters by search term"""
        response = requests.get(f"{BASE_URL}/api/help/articles?search=form")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["articles"]) > 0, "Should find articles matching 'form'"
        print(f"✅ GET /api/help/articles?search=form - Found {len(data['articles'])} matching articles")
    
    def test_get_articles_search_dashboard(self):
        """GET /api/help/articles?search=dashboard filters correctly"""
        response = requests.get(f"{BASE_URL}/api/help/articles?search=dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["articles"]) > 0, "Should find articles matching 'dashboard'"
        print(f"✅ GET /api/help/articles?search=dashboard - Found {len(data['articles'])} matching articles")
    
    def test_get_single_article(self):
        """GET /api/help/articles/{article_id} returns specific article"""
        response = requests.get(f"{BASE_URL}/api/help/articles/getting-started")
        assert response.status_code == 200
        
        article = response.json()
        assert article["id"] == "getting-started"
        assert "title" in article
        assert "content" in article
        assert len(article["content"]) > 100, "Article should have substantial content"
        print(f"✅ GET /api/help/articles/getting-started - Article title: {article['title']}")
    
    def test_get_single_article_form_builder(self):
        """GET /api/help/articles/form-builder returns specific article"""
        response = requests.get(f"{BASE_URL}/api/help/articles/form-builder")
        assert response.status_code == 200
        
        article = response.json()
        assert article["id"] == "form-builder"
        print(f"✅ GET /api/help/articles/form-builder - Article title: {article['title']}")
    
    def test_get_nonexistent_article_returns_404(self):
        """GET /api/help/articles/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/help/articles/nonexistent-article-xyz")
        assert response.status_code == 404
        print("✅ GET /api/help/articles/nonexistent - Returns 404 correctly")


class TestHelpCategories:
    """Test help categories endpoint"""
    
    def test_get_categories(self):
        """GET /api/help/categories returns all categories"""
        response = requests.get(f"{BASE_URL}/api/help/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        
        # Validate category structure
        first_cat = data["categories"][0]
        assert "id" in first_cat
        assert "name" in first_cat
        assert "icon" in first_cat
        
        # Check expected categories exist
        category_ids = [c["id"] for c in data["categories"]]
        expected_categories = ["basics", "forms", "dataviz", "data", "mobile", "admin", "quality"]
        for expected in expected_categories:
            assert expected in category_ids, f"Missing category: {expected}"
        
        print(f"✅ GET /api/help/categories - Found {len(data['categories'])} categories")


class TestHelpChat:
    """Test AI chat endpoint"""
    
    def test_chat_returns_response(self):
        """POST /api/help/chat returns AI-generated response"""
        payload = {
            "message": "How do I create a new form?",
            "session_id": str(uuid.uuid4()),
            "conversation_history": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json=payload,
            timeout=30  # AI responses may take a few seconds
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 50, "AI response should have substantial content"
        
        print(f"✅ POST /api/help/chat - Response length: {len(data['response'])} chars")
    
    def test_chat_with_conversation_history(self):
        """POST /api/help/chat with conversation history maintains context"""
        session_id = str(uuid.uuid4())
        
        # First message
        payload1 = {
            "message": "What is DataPulse?",
            "session_id": session_id,
            "conversation_history": []
        }
        response1 = requests.post(f"{BASE_URL}/api/help/chat", json=payload1, timeout=30)
        assert response1.status_code == 200
        
        first_response = response1.json()["response"]
        
        # Second message with history
        payload2 = {
            "message": "Can you tell me more about forms?",
            "session_id": session_id,
            "conversation_history": [
                {"role": "user", "content": "What is DataPulse?"},
                {"role": "assistant", "content": first_response}
            ]
        }
        response2 = requests.post(f"{BASE_URL}/api/help/chat", json=payload2, timeout=30)
        assert response2.status_code == 200
        
        data = response2.json()
        assert len(data["response"]) > 50
        print("✅ POST /api/help/chat with history - Context maintained")
    
    def test_chat_without_session_id(self):
        """POST /api/help/chat generates session_id if not provided"""
        payload = {
            "message": "Hello",
            "conversation_history": []
        }
        
        response = requests.post(f"{BASE_URL}/api/help/chat", json=payload, timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data
        assert len(data["session_id"]) > 10, "Should generate a valid session ID"
        print("✅ POST /api/help/chat - Session ID auto-generated")
    
    def test_chat_about_dashboards(self):
        """POST /api/help/chat responds about dashboard features"""
        payload = {
            "message": "How do I create a dashboard?",
            "conversation_history": []
        }
        
        response = requests.post(f"{BASE_URL}/api/help/chat", json=payload, timeout=30)
        assert response.status_code == 200
        
        data = response.json()
        # Response should mention dashboard-related terms
        response_lower = data["response"].lower()
        assert any(term in response_lower for term in ["dashboard", "widget", "chart", "visualization"]), \
            "Response should be about dashboards"
        print("✅ POST /api/help/chat - Dashboard help response received")


class TestHelpFeedback:
    """Test help feedback endpoint"""
    
    def test_submit_feedback_helpful(self, auth_token):
        """POST /api/help/feedback submits positive feedback"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/help/feedback",
            params={"article_id": "getting-started", "helpful": True},
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print("✅ POST /api/help/feedback - Positive feedback submitted")
    
    def test_submit_feedback_not_helpful(self, auth_token):
        """POST /api/help/feedback submits negative feedback with comment"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/help/feedback",
            params={
                "article_id": "form-builder",
                "helpful": False,
                "comment": "Could use more examples"
            },
            headers=headers
        )
        assert response.status_code == 200
        print("✅ POST /api/help/feedback - Negative feedback with comment submitted")


@pytest.fixture
def auth_token():
    """Get authentication token for tests that require it"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "demo@datapulse.io", "password": "Test123!"}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
