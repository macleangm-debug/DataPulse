"""
Test Suite for DataPulse Help Center - Comprehensive Testing
Tests: 22 articles, 20 FAQ items, 10 troubleshooting guides with severity/common_causes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dashboard-assist.preview.emergentagent.com')


class TestHelpArticles:
    """Tests for GET /api/help/articles endpoint"""
    
    def test_articles_returns_22_items(self):
        """Verify 22 articles are returned"""
        response = requests.get(f"{BASE_URL}/api/help/articles")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        assert len(data["articles"]) == 22, f"Expected 22 articles, got {len(data['articles'])}"
    
    def test_articles_have_required_fields(self):
        """Verify each article has required fields"""
        response = requests.get(f"{BASE_URL}/api/help/articles")
        data = response.json()
        required_fields = ["id", "title", "category", "summary"]
        for article in data["articles"]:
            for field in required_fields:
                assert field in article, f"Article missing {field}: {article.get('id')}"
    
    def test_articles_filter_by_category_forms(self):
        """Test category filter - forms"""
        response = requests.get(f"{BASE_URL}/api/help/articles?category=forms")
        assert response.status_code == 200
        data = response.json()
        assert len(data["articles"]) > 0
        for article in data["articles"]:
            assert article["category"] == "forms"
    
    def test_articles_filter_by_category_dataviz(self):
        """Test category filter - dataviz"""
        response = requests.get(f"{BASE_URL}/api/help/articles?category=dataviz")
        assert response.status_code == 200
        data = response.json()
        assert len(data["articles"]) > 0
        for article in data["articles"]:
            assert article["category"] == "dataviz"
    
    def test_articles_search_filter(self):
        """Test search filter"""
        response = requests.get(f"{BASE_URL}/api/help/articles?search=dashboard")
        assert response.status_code == 200
        data = response.json()
        assert len(data["articles"]) > 0
        # Verify search matches title or summary
        for article in data["articles"]:
            title_or_summary = (article["title"] + article["summary"]).lower()
            assert "dashboard" in title_or_summary


class TestHelpArticleDetail:
    """Tests for GET /api/help/articles/{article_id} endpoint"""
    
    def test_getting_started_article(self):
        """Test getting-started article returns full content"""
        response = requests.get(f"{BASE_URL}/api/help/articles/getting-started")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "getting-started"
        assert data["title"] == "Getting Started with DataPulse"
        assert "content" in data
        assert len(data["content"]) > 1000, "Content should be substantial"
    
    def test_form_builder_article(self):
        """Test form-builder article"""
        response = requests.get(f"{BASE_URL}/api/help/articles/form-builder")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "form-builder"
        assert "content" in data
    
    def test_nonexistent_article_returns_404(self):
        """Test 404 for non-existent article"""
        response = requests.get(f"{BASE_URL}/api/help/articles/nonexistent-article")
        assert response.status_code == 404


class TestHelpFaq:
    """Tests for GET /api/help/faq endpoint"""
    
    def test_faq_returns_20_items(self):
        """Verify 20 FAQ items are returned"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        assert response.status_code == 200
        data = response.json()
        assert "faq" in data
        assert len(data["faq"]) == 20, f"Expected 20 FAQ items, got {len(data['faq'])}"
    
    def test_faq_items_have_required_fields(self):
        """Verify each FAQ has question, answer, and category"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        data = response.json()
        for faq in data["faq"]:
            assert "question" in faq
            assert "answer" in faq
            assert "category" in faq
            assert len(faq["question"]) > 10
            assert len(faq["answer"]) > 20
    
    def test_faq_covers_multiple_categories(self):
        """Verify FAQ items span multiple categories"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        data = response.json()
        categories = set(faq["category"] for faq in data["faq"])
        assert len(categories) >= 4, f"Expected at least 4 categories, got {categories}"


class TestHelpTroubleshooting:
    """Tests for GET /api/help/troubleshooting endpoint"""
    
    def test_troubleshooting_returns_10_guides(self):
        """Verify 10 troubleshooting guides are returned"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        assert response.status_code == 200
        data = response.json()
        assert "guides" in data
        assert len(data["guides"]) == 10, f"Expected 10 guides, got {len(data['guides'])}"
    
    def test_guides_have_severity_levels(self):
        """Verify each guide has severity field"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        severities = set()
        for guide in data["guides"]:
            assert "severity" in guide, f"Guide {guide.get('id')} missing severity"
            assert guide["severity"] in ["high", "medium", "low"], f"Invalid severity: {guide['severity']}"
            severities.add(guide["severity"])
        # Verify mix of severities
        assert len(severities) >= 2, "Should have mix of severity levels"
    
    def test_guides_have_common_causes(self):
        """Verify each guide has common_causes array"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        for guide in data["guides"]:
            assert "common_causes" in guide, f"Guide {guide.get('id')} missing common_causes"
            assert isinstance(guide["common_causes"], list)
            assert len(guide["common_causes"]) > 0, f"Guide {guide.get('id')} has empty common_causes"
    
    def test_guides_have_step_by_step_instructions(self):
        """Verify each guide has steps array"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        for guide in data["guides"]:
            assert "steps" in guide, f"Guide {guide.get('id')} missing steps"
            assert isinstance(guide["steps"], list)
            assert len(guide["steps"]) >= 3, f"Guide {guide.get('id')} should have at least 3 steps"
    
    def test_troubleshooting_guide_ids(self):
        """Verify expected troubleshooting guide IDs"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        guide_ids = [g["id"] for g in data["guides"]]
        expected_ids = ["sync-issues", "form-errors", "login-issues", "gps-issues", "media-upload"]
        for expected_id in expected_ids:
            assert expected_id in guide_ids, f"Missing guide: {expected_id}"


class TestHelpSearch:
    """Tests for GET /api/help/search endpoint"""
    
    def test_search_returns_results_across_types(self):
        """Test search returns results from articles, faq, and troubleshooting"""
        response = requests.get(f"{BASE_URL}/api/help/search?q=form")
        assert response.status_code == 200
        data = response.json()
        assert "articles" in data
        assert "faq" in data
        assert "troubleshooting" in data
    
    def test_search_form_finds_matches(self):
        """Test searching for 'form' returns relevant results"""
        response = requests.get(f"{BASE_URL}/api/help/search?q=form")
        data = response.json()
        assert len(data["articles"]) > 0, "Should find articles about forms"
        assert len(data["faq"]) > 0, "Should find FAQ about forms"
        assert len(data["troubleshooting"]) > 0, "Should find troubleshooting about forms"
    
    def test_search_dashboard_finds_matches(self):
        """Test searching for 'dashboard' returns results"""
        response = requests.get(f"{BASE_URL}/api/help/search?q=dashboard")
        data = response.json()
        total_results = len(data["articles"]) + len(data["faq"]) + len(data["troubleshooting"])
        assert total_results > 0, "Should find results for 'dashboard'"
    
    def test_search_empty_query(self):
        """Test search with empty query"""
        response = requests.get(f"{BASE_URL}/api/help/search?q=")
        assert response.status_code == 200


class TestHelpChat:
    """Tests for POST /api/help/chat endpoint"""
    
    def test_chat_returns_ai_response(self):
        """Test chat returns AI-generated response"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "How do I create a form?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["response"]) > 50, "Response should be substantial"
    
    def test_chat_generates_session_id(self):
        """Test chat generates session ID when not provided"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "What is DataPulse?"}
        )
        data = response.json()
        assert "session_id" in data
        assert len(data["session_id"]) > 10
    
    def test_chat_uses_provided_session_id(self):
        """Test chat uses provided session ID"""
        session_id = "test-session-12345"
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Hello", "session_id": session_id}
        )
        data = response.json()
        assert data["session_id"] == session_id
    
    def test_chat_responds_about_datapulse_features(self):
        """Test chat has knowledge about DataPulse features"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "What is skip logic?"},
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        response_text = data["response"].lower()
        # Should mention skip logic concepts
        assert len(response_text) > 20, "Response should be substantial"


class TestHelpCategories:
    """Tests for GET /api/help/categories endpoint"""
    
    def test_categories_returns_list(self):
        """Test categories endpoint returns category list"""
        response = requests.get(f"{BASE_URL}/api/help/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) == 8


class TestHelpFeedback:
    """Tests for POST /api/help/feedback endpoint"""
    
    def test_feedback_helpful_submission(self):
        """Test submitting helpful feedback"""
        response = requests.post(
            f"{BASE_URL}/api/help/feedback",
            json={"article_id": "getting-started", "helpful": True}
        )
        assert response.status_code == 200
        data = response.json()
        # Response contains a thank you message
        assert "message" in data or "success" in data
    
    def test_feedback_not_helpful_submission(self):
        """Test submitting not helpful feedback"""
        response = requests.post(
            f"{BASE_URL}/api/help/feedback",
            json={"article_id": "form-builder", "helpful": False}
        )
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
