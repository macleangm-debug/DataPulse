"""
Qualitative Analysis Module - Backend API Tests
Tests projects, sources, codes, codings, memos, themes endpoints
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://datapulse-preview-1.preview.emergentagent.com')

# Test data
TEST_ORG_ID = "test-org-qual-123"
TEST_USER_ID = "test-user-qual-123"


class TestQualitativeProjects:
    """Test qualitative project CRUD operations"""
    
    project_id = None
    
    def test_create_project(self):
        """Test creating a new qualitative project"""
        response = requests.post(
            f"{BASE_URL}/api/qualitative/projects",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "name": "TEST_Qualitative Project",
                "description": "Test project for qualitative analysis",
                "methodology": "thematic",
                "research_questions": ["What are the main themes?", "How do participants describe their experience?"]
            }
        )
        
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain project id"
        assert "message" in data, "Response should contain success message"
        
        # Store project_id for subsequent tests
        TestQualitativeProjects.project_id = data["id"]
        print(f"Created project with id: {data['id']}")
    
    def test_list_projects(self):
        """Test listing qualitative projects"""
        response = requests.get(
            f"{BASE_URL}/api/qualitative/projects",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"List projects failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify our test project is in the list
        project_ids = [p["id"] for p in data]
        assert TestQualitativeProjects.project_id in project_ids, "Created project should be in list"
        print(f"Found {len(data)} projects")
    
    def test_get_project(self):
        """Test getting a specific project"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set from create test"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/projects/{project_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get project failed: {response.text}"
        data = response.json()
        assert data["id"] == project_id, "Project ID should match"
        assert data["name"] == "TEST_Qualitative Project", "Project name should match"
        assert data["methodology"] == "thematic", "Methodology should match"
        print(f"Project details: {data['name']}")
    
    def test_update_project(self):
        """Test updating a project"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.patch(
            f"{BASE_URL}/api/qualitative/projects/{project_id}",
            params={"org_id": TEST_ORG_ID},
            json={"description": "Updated description for testing"}
        )
        
        assert response.status_code == 200, f"Update project failed: {response.text}"
        
        # Verify update
        get_response = requests.get(
            f"{BASE_URL}/api/qualitative/projects/{project_id}",
            params={"org_id": TEST_ORG_ID}
        )
        data = get_response.json()
        assert data["description"] == "Updated description for testing", "Description should be updated"
        print("Project updated successfully")


class TestQualitativeSources:
    """Test source (transcript) CRUD operations"""
    
    source_id = None
    
    def test_create_source(self):
        """Test creating a new source"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/sources",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "name": "TEST_Interview_001",
                "source_type": "transcript",
                "content": """Interviewer: Thank you for joining us today. Can you tell me about your experience?

Participant: Of course. It has been quite a journey. When I first started, I was very nervous about the process. But over time, I became more comfortable.

Interviewer: What made you feel more comfortable?

Participant: The support from the team was crucial. They were always there to answer my questions and provide guidance.

Interviewer: Can you give me a specific example?

Participant: Sure. When I had trouble understanding the documentation, Sarah from the support team spent an hour walking me through everything step by step.""",
                "language": "en",
                "site": "Site A",
                "participant_pseudonym": "P001"
            }
        )
        
        assert response.status_code == 200, f"Create source failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain source id"
        assert "word_count" in data, "Response should contain word count"
        assert "utterance_count" in data, "Response should contain utterance count"
        
        TestQualitativeSources.source_id = data["id"]
        print(f"Created source with id: {data['id']}, words: {data['word_count']}, utterances: {data['utterance_count']}")
    
    def test_list_sources(self):
        """Test listing sources in a project"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/sources",
            params={"project_id": project_id, "org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"List sources failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one source"
        
        # Verify our test source is in the list
        source_ids = [s["id"] for s in data]
        assert TestQualitativeSources.source_id in source_ids, "Created source should be in list"
        print(f"Found {len(data)} sources")
    
    def test_get_source(self):
        """Test getting a specific source with full content"""
        source_id = TestQualitativeSources.source_id
        assert source_id is not None, "Source ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/sources/{source_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get source failed: {response.text}"
        data = response.json()
        assert data["id"] == source_id, "Source ID should match"
        assert "content" in data, "Source should contain content"
        assert "utterances" in data, "Source should contain utterances"
        assert "codings" in data, "Source should contain codings array"
        print(f"Source details: {data['name']}, content length: {len(data['content'])}")


class TestQualitativeCodes:
    """Test codebook CRUD operations"""
    
    code_id = None
    child_code_id = None
    
    def test_create_code(self):
        """Test creating a new code"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codes",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "name": "TEST_Support Experience",
                "definition": "References to support received from team members",
                "description": "Used when participant describes interactions with support staff",
                "color": "#10B981",
                "code_type": "descriptive"
            }
        )
        
        assert response.status_code == 200, f"Create code failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain code id"
        
        TestQualitativeCodes.code_id = data["id"]
        print(f"Created code with id: {data['id']}")
    
    def test_create_child_code(self):
        """Test creating a child code (hierarchy)"""
        project_id = TestQualitativeProjects.project_id
        parent_id = TestQualitativeCodes.code_id
        assert project_id is not None, "Project ID not set"
        assert parent_id is not None, "Parent code ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codes",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "name": "TEST_Personal Support",
                "definition": "One-on-one personal support instances",
                "parent_id": parent_id,
                "color": "#3B82F6",
                "code_type": "descriptive"
            }
        )
        
        assert response.status_code == 200, f"Create child code failed: {response.text}"
        data = response.json()
        TestQualitativeCodes.child_code_id = data["id"]
        print(f"Created child code with id: {data['id']}")
    
    def test_list_codes_flat(self):
        """Test listing codes as flat list"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/codes",
            params={"project_id": project_id, "org_id": TEST_ORG_ID, "flat": True}
        )
        
        assert response.status_code == 200, f"List codes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 2, "Should have at least 2 codes"
        
        # Verify all codes have expected fields
        for code in data:
            assert "id" in code, "Code should have id"
            assert "name" in code, "Code should have name"
            assert "color" in code, "Code should have color"
            assert "usage_count" in code, "Code should have usage_count"
        
        print(f"Found {len(data)} codes (flat)")
    
    def test_get_code(self):
        """Test getting a specific code"""
        code_id = TestQualitativeCodes.code_id
        assert code_id is not None, "Code ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/codes/{code_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get code failed: {response.text}"
        data = response.json()
        assert data["id"] == code_id, "Code ID should match"
        assert data["name"] == "TEST_Support Experience", "Code name should match"
        print(f"Code details: {data['name']}")


class TestQualitativeCodings:
    """Test coding (applying codes to text) operations"""
    
    coding_id = None
    
    def test_create_coding(self):
        """Test applying a code to a text excerpt"""
        project_id = TestQualitativeProjects.project_id
        source_id = TestQualitativeSources.source_id
        code_id = TestQualitativeCodes.code_id
        
        assert project_id is not None, "Project ID not set"
        assert source_id is not None, "Source ID not set"
        assert code_id is not None, "Code ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codings",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "source_id": source_id,
                "code_id": code_id,
                "start_char": 250,
                "end_char": 350,
                "excerpt_text": "The support from the team was crucial. They were always there to answer my questions",
                "notes": "Strong positive sentiment about team support"
            }
        )
        
        assert response.status_code == 200, f"Create coding failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain coding id"
        
        TestQualitativeCodings.coding_id = data["id"]
        print(f"Created coding with id: {data['id']}")
    
    def test_list_codings(self):
        """Test listing codings in a project"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/codings",
            params={"project_id": project_id, "org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"List codings failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one coding"
        
        # Verify coding structure
        coding = data[0]
        assert "id" in coding, "Coding should have id"
        assert "source_id" in coding, "Coding should have source_id"
        assert "code_id" in coding, "Coding should have code_id"
        assert "excerpt_text" in coding, "Coding should have excerpt_text"
        assert "code_color" in coding, "Coding should have code_color"
        
        print(f"Found {len(data)} codings")
    
    def test_verify_source_shows_codings(self):
        """Test that source endpoint returns codings"""
        source_id = TestQualitativeSources.source_id
        assert source_id is not None, "Source ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/sources/{source_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get source failed: {response.text}"
        data = response.json()
        assert "codings" in data, "Source should contain codings"
        assert len(data["codings"]) > 0, "Source should have at least one coding"
        
        coding = data["codings"][0]
        assert "code_id" in coding, "Coding should have code_id"
        assert "start_char" in coding, "Coding should have start_char"
        assert "end_char" in coding, "Coding should have end_char"
        assert "code_color" in coding, "Coding should have code_color"
        
        print(f"Source has {len(data['codings'])} codings embedded")


class TestQualitativeRetrievals:
    """Test code retrieval and search operations"""
    
    def test_retrieve_by_code(self):
        """Test retrieving excerpts by code"""
        project_id = TestQualitativeProjects.project_id
        code_id = TestQualitativeCodes.code_id
        
        assert project_id is not None, "Project ID not set"
        assert code_id is not None, "Code ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/retrieve/by-code",
            params={"org_id": TEST_ORG_ID},
            json={
                "project_id": project_id,
                "code_ids": [code_id],
                "operator": "OR",
                "include_context": True,
                "context_chars": 50
            }
        )
        
        assert response.status_code == 200, f"Retrieve by code failed: {response.text}"
        data = response.json()
        assert "results" in data, "Response should contain results"
        assert "total_results" in data, "Response should contain total_results"
        assert data["total_results"] > 0, "Should have at least one result"
        
        print(f"Retrieved {data['total_results']} excerpts for code")
    
    def test_text_search(self):
        """Test text search across sources"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/retrieve/text-search",
            params={"org_id": TEST_ORG_ID},
            json={
                "project_id": project_id,
                "query": "support",
                "search_type": "exact"
            }
        )
        
        assert response.status_code == 200, f"Text search failed: {response.text}"
        data = response.json()
        assert "results" in data, "Response should contain results"
        assert "total_results" in data, "Response should contain total_results"
        
        print(f"Text search found {data['total_results']} matches")


class TestQualitativeStatistics:
    """Test project statistics endpoint"""
    
    def test_get_project_stats(self):
        """Test getting project statistics"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/stats/{project_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        data = response.json()
        
        # Verify all expected stats are present
        assert "source_count" in data, "Should have source_count"
        assert "code_count" in data, "Should have code_count"
        assert "coding_count" in data, "Should have coding_count"
        assert "code_frequency" in data, "Should have code_frequency"
        
        print(f"Project stats: sources={data['source_count']}, codes={data['code_count']}, codings={data['coding_count']}")


class TestQualitativeMemos:
    """Test memo operations"""
    
    memo_id = None
    
    def test_create_memo(self):
        """Test creating a memo"""
        project_id = TestQualitativeProjects.project_id
        code_id = TestQualitativeCodes.code_id
        
        assert project_id is not None, "Project ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/memos",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "title": "TEST_Analytic Memo - Support Theme",
                "content": "The theme of support appears prominently across interviews. Participants consistently highlight the importance of personal, one-on-one support.",
                "memo_type": "analytic",
                "linked_code_id": code_id,
                "tags": ["support", "team", "positive"]
            }
        )
        
        assert response.status_code == 200, f"Create memo failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain memo id"
        
        TestQualitativeMemos.memo_id = data["id"]
        print(f"Created memo with id: {data['id']}")
    
    def test_list_memos(self):
        """Test listing memos"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/memos",
            params={"project_id": project_id, "org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"List memos failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one memo"
        
        print(f"Found {len(data)} memos")


class TestQualitativeThemes:
    """Test theme operations"""
    
    theme_id = None
    
    def test_create_theme(self):
        """Test creating a theme"""
        project_id = TestQualitativeProjects.project_id
        coding_id = TestQualitativeCodings.coding_id
        
        assert project_id is not None, "Project ID not set"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/themes",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": project_id,
                "title": "TEST_Theme: Value of Personal Support",
                "description": "Participants consistently emphasize the importance of personalized, one-on-one support from team members",
                "supporting_evidence": [coding_id] if coding_id else [],
                "summary": "Personal support is a key factor in participant satisfaction"
            }
        )
        
        assert response.status_code == 200, f"Create theme failed: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain theme id"
        
        TestQualitativeThemes.theme_id = data["id"]
        print(f"Created theme with id: {data['id']}")
    
    def test_list_themes(self):
        """Test listing themes"""
        project_id = TestQualitativeProjects.project_id
        assert project_id is not None, "Project ID not set"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/themes",
            params={"project_id": project_id, "org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"List themes failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one theme"
        
        print(f"Found {len(data)} themes")


class TestQualitativeCleanup:
    """Cleanup test data"""
    
    def test_delete_theme(self):
        """Delete test theme"""
        theme_id = TestQualitativeThemes.theme_id
        if theme_id:
            # There's no theme delete endpoint, so skip
            print("Theme cleanup - skipping (no delete endpoint)")
    
    def test_delete_coding(self):
        """Delete test coding"""
        coding_id = TestQualitativeCodings.coding_id
        if coding_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/codings/{coding_id}",
                params={"org_id": TEST_ORG_ID}
            )
            assert response.status_code == 200, f"Delete coding failed: {response.text}"
            print(f"Deleted coding: {coding_id}")
    
    def test_delete_child_code(self):
        """Delete test child code"""
        code_id = TestQualitativeCodes.child_code_id
        if code_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/codes/{code_id}",
                params={"org_id": TEST_ORG_ID}
            )
            assert response.status_code == 200, f"Delete child code failed: {response.text}"
            print(f"Deleted child code: {code_id}")
    
    def test_delete_code(self):
        """Delete test code"""
        code_id = TestQualitativeCodes.code_id
        if code_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/codes/{code_id}",
                params={"org_id": TEST_ORG_ID}
            )
            assert response.status_code == 200, f"Delete code failed: {response.text}"
            print(f"Deleted code: {code_id}")
    
    def test_delete_source(self):
        """Delete test source"""
        source_id = TestQualitativeSources.source_id
        if source_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/sources/{source_id}",
                params={"org_id": TEST_ORG_ID}
            )
            assert response.status_code == 200, f"Delete source failed: {response.text}"
            print(f"Deleted source: {source_id}")
    
    def test_delete_project(self):
        """Delete test project"""
        project_id = TestQualitativeProjects.project_id
        if project_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/projects/{project_id}",
                params={"org_id": TEST_ORG_ID}
            )
            assert response.status_code == 200, f"Delete project failed: {response.text}"
            print(f"Deleted project: {project_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
