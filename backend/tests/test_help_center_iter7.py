"""
Test Help Center API Endpoints - Iteration 7
Testing the migration from static frontend data to dynamic backend APIs
All content (categories, articles, FAQ, troubleshooting, shortcuts, what's new) 
should now be fetched from backend APIs.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHelpCategoriesFull:
    """Test GET /api/help/categories-full - Returns 8 categories with articles"""
    
    def test_categories_full_returns_8_categories(self):
        """GET /api/help/categories-full should return 8 categories"""
        response = requests.get(f"{BASE_URL}/api/help/categories-full")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "categories" in data, "Response should have 'categories' key"
        
        categories = data["categories"]
        assert len(categories) == 8, f"Expected 8 categories, got {len(categories)}"
        
    def test_categories_full_has_required_fields(self):
        """Each category should have id, title, icon, description, articles"""
        response = requests.get(f"{BASE_URL}/api/help/categories-full")
        data = response.json()
        
        for cat in data["categories"]:
            assert "id" in cat, f"Category missing 'id'"
            assert "title" in cat, f"Category missing 'title'"
            assert "icon" in cat, f"Category missing 'icon'"
            assert "description" in cat, f"Category missing 'description'"
            assert "articles" in cat, f"Category missing 'articles'"
            assert isinstance(cat["articles"], list), "articles should be a list"
    
    def test_categories_full_expected_category_ids(self):
        """Verify the 8 expected category IDs are present"""
        response = requests.get(f"{BASE_URL}/api/help/categories-full")
        data = response.json()
        
        expected_ids = ["getting-started", "forms", "dataviz", "data", "mobile", "team", "quality", "settings"]
        actual_ids = [cat["id"] for cat in data["categories"]]
        
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Missing category: {expected_id}"
    
    def test_categories_contain_articles(self):
        """Categories should contain articles with id, title, readTime"""
        response = requests.get(f"{BASE_URL}/api/help/categories-full")
        data = response.json()
        
        # Check at least some categories have articles
        has_articles = any(len(cat["articles"]) > 0 for cat in data["categories"])
        assert has_articles, "At least some categories should have articles"
        
        # Check article structure
        for cat in data["categories"]:
            for article in cat["articles"]:
                assert "id" in article, "Article missing 'id'"
                assert "title" in article, "Article missing 'title'"
                assert "readTime" in article, "Article missing 'readTime'"


class TestHelpFaq:
    """Test GET /api/help/faq - Returns 20 FAQ items grouped by category"""
    
    def test_faq_returns_items(self):
        """GET /api/help/faq should return FAQ items"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "faq" in data, "Response should have 'faq' key"
        
    def test_faq_returns_20_items(self):
        """GET /api/help/faq should return 20 FAQ items"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        data = response.json()
        
        faq_list = data["faq"]
        assert len(faq_list) == 20, f"Expected 20 FAQ items, got {len(faq_list)}"
    
    def test_faq_items_have_required_fields(self):
        """Each FAQ item should have question, answer, category"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        data = response.json()
        
        for faq in data["faq"]:
            assert "question" in faq, "FAQ missing 'question'"
            assert "answer" in faq, "FAQ missing 'answer'"
            assert "category" in faq, "FAQ missing 'category'"
    
    def test_faq_grouped_by_category(self):
        """FAQ items should be grouped by category"""
        response = requests.get(f"{BASE_URL}/api/help/faq")
        data = response.json()
        
        categories = set(faq["category"] for faq in data["faq"])
        assert len(categories) > 1, "FAQ should have multiple categories"


class TestHelpTroubleshooting:
    """Test GET /api/help/troubleshooting - Returns 10 guides with severity levels"""
    
    def test_troubleshooting_returns_guides(self):
        """GET /api/help/troubleshooting should return guides"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "guides" in data, "Response should have 'guides' key"
    
    def test_troubleshooting_returns_10_guides(self):
        """GET /api/help/troubleshooting should return 10 guides"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        
        guides = data["guides"]
        assert len(guides) == 10, f"Expected 10 troubleshooting guides, got {len(guides)}"
    
    def test_troubleshooting_guides_have_severity(self):
        """Each guide should have id, title, severity, steps"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        
        for guide in data["guides"]:
            assert "id" in guide, "Guide missing 'id'"
            assert "title" in guide, "Guide missing 'title'"
            assert "severity" in guide, "Guide missing 'severity'"
            assert guide["severity"] in ["high", "medium", "low"], f"Invalid severity: {guide['severity']}"
            assert "steps" in guide, "Guide missing 'steps'"
            assert isinstance(guide["steps"], list), "Steps should be a list"
    
    def test_troubleshooting_has_common_causes(self):
        """Guides should have common_causes list"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting")
        data = response.json()
        
        for guide in data["guides"]:
            assert "common_causes" in guide, "Guide missing 'common_causes'"
            assert isinstance(guide["common_causes"], list), "common_causes should be a list"


class TestHelpShortcuts:
    """Test GET /api/help/shortcuts - Returns 5 shortcut categories"""
    
    def test_shortcuts_returns_categories(self):
        """GET /api/help/shortcuts should return shortcut categories"""
        response = requests.get(f"{BASE_URL}/api/help/shortcuts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "shortcuts" in data, "Response should have 'shortcuts' key"
    
    def test_shortcuts_returns_5_categories(self):
        """GET /api/help/shortcuts should return 5 shortcut categories"""
        response = requests.get(f"{BASE_URL}/api/help/shortcuts")
        data = response.json()
        
        shortcuts = data["shortcuts"]
        assert len(shortcuts) == 5, f"Expected 5 shortcut categories, got {len(shortcuts)}"
    
    def test_shortcuts_categories_structure(self):
        """Each category should have category name and shortcuts list"""
        response = requests.get(f"{BASE_URL}/api/help/shortcuts")
        data = response.json()
        
        expected_categories = ["Navigation", "Forms", "Data Entry", "Dashboards", "General"]
        actual_categories = [s["category"] for s in data["shortcuts"]]
        
        for expected in expected_categories:
            assert expected in actual_categories, f"Missing shortcut category: {expected}"
    
    def test_shortcuts_have_keys_and_action(self):
        """Each shortcut should have keys array and action"""
        response = requests.get(f"{BASE_URL}/api/help/shortcuts")
        data = response.json()
        
        for cat in data["shortcuts"]:
            assert "shortcuts" in cat, "Category missing 'shortcuts' list"
            for shortcut in cat["shortcuts"]:
                assert "keys" in shortcut, "Shortcut missing 'keys'"
                assert "action" in shortcut, "Shortcut missing 'action'"
                assert isinstance(shortcut["keys"], list), "keys should be a list"


class TestHelpWhatsNew:
    """Test GET /api/help/whats-new - Returns 4 version releases"""
    
    def test_whats_new_returns_releases(self):
        """GET /api/help/whats-new should return releases"""
        response = requests.get(f"{BASE_URL}/api/help/whats-new")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "releases" in data, "Response should have 'releases' key"
    
    def test_whats_new_returns_4_releases(self):
        """GET /api/help/whats-new should return 4 version releases"""
        response = requests.get(f"{BASE_URL}/api/help/whats-new")
        data = response.json()
        
        releases = data["releases"]
        assert len(releases) == 4, f"Expected 4 releases, got {len(releases)}"
    
    def test_whats_new_releases_have_required_fields(self):
        """Each release should have version, date, highlights"""
        response = requests.get(f"{BASE_URL}/api/help/whats-new")
        data = response.json()
        
        for release in data["releases"]:
            assert "version" in release, "Release missing 'version'"
            assert "date" in release, "Release missing 'date'"
            assert "highlights" in release, "Release missing 'highlights'"
            assert isinstance(release["highlights"], list), "highlights should be a list"
    
    def test_whats_new_highlights_have_type(self):
        """Each highlight should have type, title, description"""
        response = requests.get(f"{BASE_URL}/api/help/whats-new")
        data = response.json()
        
        for release in data["releases"]:
            for highlight in release["highlights"]:
                assert "type" in highlight, "Highlight missing 'type'"
                assert highlight["type"] in ["feature", "improvement", "bugfix"], f"Invalid type: {highlight['type']}"
                assert "title" in highlight, "Highlight missing 'title'"
                assert "description" in highlight, "Highlight missing 'description'"


class TestHelpSearch:
    """Test GET /api/help/search?q=form - Returns matching results"""
    
    def test_search_requires_query(self):
        """GET /api/help/search without q should return error"""
        response = requests.get(f"{BASE_URL}/api/help/search")
        # FastAPI returns 422 for missing required query params
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
    
    def test_search_returns_results_for_form(self):
        """GET /api/help/search?q=form should return matching articles"""
        response = requests.get(f"{BASE_URL}/api/help/search", params={"q": "form"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "articles" in data, "Response should have 'articles' key"
        assert len(data["articles"]) > 0, "Should return articles for 'form' search"
    
    def test_search_returns_faq_results(self):
        """GET /api/help/search?q=form should return matching FAQs"""
        response = requests.get(f"{BASE_URL}/api/help/search", params={"q": "form"})
        data = response.json()
        
        assert "faq" in data, "Response should have 'faq' key"
        # May or may not have FAQ results depending on content
    
    def test_search_returns_troubleshooting_results(self):
        """GET /api/help/search?q=sync should return matching troubleshooting"""
        response = requests.get(f"{BASE_URL}/api/help/search", params={"q": "sync"})
        data = response.json()
        
        assert "troubleshooting" in data, "Response should have 'troubleshooting' key"
        assert len(data["troubleshooting"]) > 0, "Should return troubleshooting for 'sync' search"
    
    def test_search_case_insensitive(self):
        """Search should be case insensitive"""
        response_lower = requests.get(f"{BASE_URL}/api/help/search", params={"q": "dashboard"})
        response_upper = requests.get(f"{BASE_URL}/api/help/search", params={"q": "DASHBOARD"})
        
        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        
        # Both should return similar results
        data_lower = response_lower.json()
        data_upper = response_upper.json()
        
        assert len(data_lower["articles"]) == len(data_upper["articles"]), "Search should be case insensitive"


class TestHelpArticles:
    """Test GET /api/help/articles - Article content loads dynamically"""
    
    def test_articles_list_endpoint(self):
        """GET /api/help/articles should return list of articles"""
        response = requests.get(f"{BASE_URL}/api/help/articles")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "articles" in data or isinstance(data, list), "Response should have articles"
    
    def test_get_specific_article(self):
        """GET /api/help/articles/{id} should return article content"""
        response = requests.get(f"{BASE_URL}/api/help/articles/getting-started")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data or "title" in data, "Article should have id and title"
        assert "content" in data, "Article should have content"
    
    def test_get_nonexistent_article_returns_404(self):
        """GET /api/help/articles/{invalid_id} should return 404"""
        response = requests.get(f"{BASE_URL}/api/help/articles/nonexistent-article-xyz")
        assert response.status_code == 404, f"Expected 404 for nonexistent article, got {response.status_code}"
    
    def test_articles_filter_by_category(self):
        """GET /api/help/articles?category=forms should filter results"""
        response = requests.get(f"{BASE_URL}/api/help/articles", params={"category": "forms"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        articles = data.get("articles", data)
        # All returned articles should be in the forms category
        for article in articles:
            assert article.get("category") == "forms", f"Article {article.get('id')} not in forms category"


class TestHelpCategories:
    """Test GET /api/help/categories - Basic categories endpoint"""
    
    def test_categories_endpoint(self):
        """GET /api/help/categories should return categories"""
        response = requests.get(f"{BASE_URL}/api/help/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "categories" in data, "Response should have 'categories' key"


class TestHelpFeedback:
    """Test POST /api/help/feedback - Feedback submission"""
    
    def test_feedback_submission(self):
        """POST /api/help/feedback should accept feedback"""
        response = requests.post(
            f"{BASE_URL}/api/help/feedback",
            params={
                "article_id": "getting-started",
                "helpful": True,
                "comment": "Test feedback from pytest"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should have 'message' key"


class TestHelpTroubleshootingById:
    """Test GET /api/help/troubleshooting/{guide_id}"""
    
    def test_get_specific_troubleshooting_guide(self):
        """GET /api/help/troubleshooting/{id} should return specific guide"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting/sync-issues")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["id"] == "sync-issues", "Should return the sync-issues guide"
        assert "title" in data
        assert "steps" in data
    
    def test_get_nonexistent_troubleshooting_guide(self):
        """GET /api/help/troubleshooting/{invalid_id} should return 404"""
        response = requests.get(f"{BASE_URL}/api/help/troubleshooting/nonexistent-guide")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
