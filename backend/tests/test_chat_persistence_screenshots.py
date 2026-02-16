"""
Test Chat Persistence and Article Screenshots Features
Tests P1: Article screenshots and P2: Chat session persistence
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Skip all tests if no backend URL
if not BASE_URL:
    pytest.skip("No REACT_APP_BACKEND_URL set", allow_module_level=True)


class TestChatPersistence:
    """P2: Chat session persistence to MongoDB"""
    
    def test_chat_creates_session(self):
        """POST /api/help/chat creates a session and returns session_id"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "How do I create a form?"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        assert "response" in data, "Response should contain response text"
        assert len(data["session_id"]) > 0, "session_id should not be empty"
        assert len(data["response"]) > 0, "AI response should not be empty"
        print(f"✅ Chat session created: {data['session_id'][:8]}...")
        return data["session_id"]
    
    def test_chat_uses_existing_session(self):
        """POST /api/help/chat with session_id uses existing session"""
        # First message
        response1 = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Tell me about dashboards"}
        )
        assert response1.status_code == 200
        session_id = response1.json()["session_id"]
        
        # Second message with same session
        response2 = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={
                "message": "What widget types are available?",
                "session_id": session_id
            }
        )
        assert response2.status_code == 200
        data = response2.json()
        assert data["session_id"] == session_id, "Should return same session_id"
        print(f"✅ Session reused correctly: {session_id[:8]}...")
    
    def test_get_session_history(self):
        """GET /api/help/chat/sessions/{session_id} retrieves persisted messages"""
        # Create a session with messages
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "What is skip logic?"}
        )
        assert response.status_code == 200
        session_id = response.json()["session_id"]
        
        # Get session history
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "session_id" in data, "Response should contain session_id"
        assert "messages" in data, "Response should contain messages"
        assert isinstance(data["messages"], list), "messages should be a list"
        assert len(data["messages"]) >= 2, "Should have at least 2 messages (user + assistant)"
        
        # Verify message structure
        user_msg = next((m for m in data["messages"] if m.get("role") == "user"), None)
        assistant_msg = next((m for m in data["messages"] if m.get("role") == "assistant"), None)
        
        assert user_msg is not None, "Should have user message"
        assert assistant_msg is not None, "Should have assistant message"
        assert "content" in user_msg, "User message should have content"
        assert "timestamp" in user_msg, "User message should have timestamp"
        print(f"✅ Session history retrieved with {len(data['messages'])} messages")
    
    def test_get_nonexistent_session_returns_404(self):
        """GET /api/help/chat/sessions/{invalid_id} returns 404"""
        fake_session_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{fake_session_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent session returns 404")
    
    def test_delete_session_history(self):
        """DELETE /api/help/chat/sessions/{session_id} removes session"""
        # Create a session
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Test message for deletion"}
        )
        assert response.status_code == 200
        session_id = response.json()["session_id"]
        
        # Verify it exists
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 200, "Session should exist before delete"
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 404, "Session should be deleted"
        print(f"✅ Session {session_id[:8]}... deleted successfully")
    
    def test_delete_nonexistent_session_returns_404(self):
        """DELETE /api/help/chat/sessions/{invalid_id} returns 404"""
        fake_session_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/help/chat/sessions/{fake_session_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Delete non-existent session returns 404")
    
    def test_multi_turn_conversation_persistence(self):
        """Multiple messages in same session are persisted"""
        # Start a conversation
        response1 = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "What is DataPulse?"}
        )
        assert response1.status_code == 200
        session_id = response1.json()["session_id"]
        
        # Add another message
        response2 = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "What about offline mode?", "session_id": session_id}
        )
        assert response2.status_code == 200
        
        # Add a third message
        response3 = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "How do I export data?", "session_id": session_id}
        )
        assert response3.status_code == 200
        
        # Verify all messages are persisted
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 200
        
        data = response.json()
        messages = data.get("messages", [])
        
        # Should have 6 messages (3 user + 3 assistant)
        assert len(messages) >= 6, f"Expected at least 6 messages, got {len(messages)}"
        
        user_messages = [m for m in messages if m.get("role") == "user"]
        assert len(user_messages) >= 3, "Should have at least 3 user messages"
        print(f"✅ Multi-turn conversation with {len(messages)} messages persisted")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/help/chat/sessions/{session_id}")


class TestArticleScreenshots:
    """P1: Article screenshots in Help Center"""
    
    def test_article_has_screenshot_url(self):
        """GET /api/help/articles/{id} returns screenshot_url for articles with screenshots"""
        # Test article that has a screenshot (getting-started has screenshot: "/dashboard")
        response = requests.get(f"{BASE_URL}/api/help/articles/getting-started")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "screenshot_url" in data, "Article should have screenshot_url"
        assert data["screenshot_url"] == "/help-screenshots/dashboard.jpeg", \
            f"Expected /help-screenshots/dashboard.jpeg, got {data.get('screenshot_url')}"
        print(f"✅ getting-started article has screenshot_url: {data['screenshot_url']}")
    
    def test_form_builder_article_screenshot(self):
        """form-builder article has correct screenshot URL"""
        response = requests.get(f"{BASE_URL}/api/help/articles/form-builder")
        assert response.status_code == 200
        
        data = response.json()
        assert "screenshot_url" in data, "form-builder should have screenshot_url"
        assert data["screenshot_url"] == "/help-screenshots/forms.jpeg"
        print(f"✅ form-builder article has screenshot_url: {data['screenshot_url']}")
    
    def test_dashboards_article_screenshot(self):
        """dashboards article has correct screenshot URL"""
        response = requests.get(f"{BASE_URL}/api/help/articles/dashboards")
        assert response.status_code == 200
        
        data = response.json()
        assert "screenshot_url" in data, "dashboards should have screenshot_url"
        assert data["screenshot_url"] == "/help-screenshots/dashboards.jpeg"
        print(f"✅ dashboards article has screenshot_url: {data['screenshot_url']}")
    
    def test_chart_studio_article_screenshot(self):
        """chart-studio article has correct screenshot URL"""
        response = requests.get(f"{BASE_URL}/api/help/articles/chart-studio")
        assert response.status_code == 200
        
        data = response.json()
        assert "screenshot_url" in data, "chart-studio should have screenshot_url"
        assert data["screenshot_url"] == "/help-screenshots/charts.jpeg"
        print(f"✅ chart-studio article has screenshot_url: {data['screenshot_url']}")
    
    def test_user_management_article_screenshot(self):
        """user-management article has correct screenshot URL"""
        response = requests.get(f"{BASE_URL}/api/help/articles/user-management")
        assert response.status_code == 200
        
        data = response.json()
        assert "screenshot_url" in data, "user-management should have screenshot_url"
        assert data["screenshot_url"] == "/help-screenshots/user-management.jpeg"
        print(f"✅ user-management article has screenshot_url: {data['screenshot_url']}")
    
    def test_article_without_screenshot_field(self):
        """Articles without screenshots shouldn't have screenshot_url or have None"""
        # Security article does not have a screenshot in the mapping
        response = requests.get(f"{BASE_URL}/api/help/articles/security")
        assert response.status_code == 200
        
        data = response.json()
        # Either no screenshot_url or it's None
        screenshot_url = data.get("screenshot_url")
        assert screenshot_url is None or screenshot_url not in [
            "/help-screenshots/dashboard.jpeg",
            "/help-screenshots/forms.jpeg"
        ], "Security article shouldn't have a mapped screenshot"
        print(f"✅ security article correctly has no mapped screenshot")
    
    def test_screenshot_files_exist(self):
        """Screenshot files can be accessed from public folder"""
        screenshot_files = [
            "dashboard.jpeg",
            "forms.jpeg", 
            "dashboards.jpeg",
            "charts.jpeg",
            "user-management.jpeg",
            "help-center.jpeg"
        ]
        
        for filename in screenshot_files:
            url = f"{BASE_URL}/help-screenshots/{filename}"
            response = requests.head(url)
            # Should return 200 for image files
            assert response.status_code in [200, 304], \
                f"Screenshot {filename} not accessible: {response.status_code}"
            print(f"✅ Screenshot accessible: {filename}")


class TestChatEndpointStructure:
    """Test chat endpoint request/response structure"""
    
    def test_chat_response_structure(self):
        """Chat response has correct structure"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Hello"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("response"), str), "response should be string"
        assert isinstance(data.get("session_id"), str), "session_id should be string"
        print("✅ Chat response has correct structure")
    
    def test_chat_without_session_id_creates_new(self):
        """Chat without session_id creates a new session"""
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Test without session_id"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data, "Should generate new session_id"
        assert len(data["session_id"]) == 36, "session_id should be UUID format"
        print(f"✅ New session created: {data['session_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/help/chat/sessions/{data['session_id']}")
    
    def test_session_history_response_structure(self):
        """Session history response has correct structure"""
        # Create session first
        response = requests.post(
            f"{BASE_URL}/api/help/chat",
            json={"message": "Test for structure check"}
        )
        session_id = response.json()["session_id"]
        
        # Get history
        response = requests.get(f"{BASE_URL}/api/help/chat/sessions/{session_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "session_id" in data, "Should have session_id"
        assert "messages" in data, "Should have messages"
        assert "created_at" in data, "Should have created_at"
        assert "updated_at" in data, "Should have updated_at"
        
        # Verify message structure
        if data["messages"]:
            msg = data["messages"][0]
            assert "role" in msg, "Message should have role"
            assert "content" in msg, "Message should have content"
            assert "timestamp" in msg, "Message should have timestamp"
        
        print("✅ Session history has correct structure")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/help/chat/sessions/{session_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
