"""
Qualitative Analysis Module - Phase 2 & 3 Backend API Tests
Tests AI features, collaboration workflows, and advanced queries
"""

import pytest
import requests
import os
from datetime import datetime
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://research-coding.preview.emergentagent.com')

# Test data - using provided test IDs
TEST_ORG_ID = "test-org-123"
TEST_USER_ID = "test-user-phase2"
TEST_PROJECT_ID = "698afc3589d798aeeb52eaaa"
TEST_SOURCE_ID = "698afc3e89d798aeeb52eaab"
TEST_CODE_ID = "698afc4489d798aeeb52eaac"


class TestSetup:
    """Setup test data for Phase 2 & 3 tests"""
    
    project_id = None
    source_id = None
    code_id = None
    second_code_id = None
    coding_id = None
    
    def test_create_project(self):
        """Create a test project"""
        response = requests.post(
            f"{BASE_URL}/api/qualitative/projects",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "name": "TEST_Phase2_3_Project",
                "description": "Test project for Phase 2 & 3 features",
                "methodology": "thematic",
                "research_questions": ["What patterns emerge?", "How do participants describe experiences?"]
            }
        )
        
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        TestSetup.project_id = data["id"]
        print(f"Created project: {TestSetup.project_id}")
    
    def test_create_source_with_pii(self):
        """Create a source with PII for testing detection/anonymization"""
        response = requests.post(
            f"{BASE_URL}/api/qualitative/sources",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": TestSetup.project_id,
                "name": "TEST_Interview_PII",
                "source_type": "transcript",
                "content": """Interviewer: Can you introduce yourself?

John Smith: Yes, my name is John Smith. I live at 123 Main Street, New York. You can reach me at john.smith@email.com or call me at 555-123-4567.

Interviewer: Tell me about your experience with the program.

John Smith: The program was very helpful. I found the support team, especially Sarah Johnson, to be incredibly patient. She helped me understand the documentation.

Interviewer: What improvements would you suggest?

John Smith: The onboarding process could be smoother. My colleague Maria Garcia had similar feedback.""",
                "language": "en",
                "attributes": {"site": "Site A", "participant_type": "Client"}
            }
        )
        
        assert response.status_code == 200, f"Create source failed: {response.text}"
        data = response.json()
        TestSetup.source_id = data["id"]
        print(f"Created source with PII: {TestSetup.source_id}")
    
    def test_create_codes(self):
        """Create test codes for AI suggestions and queries"""
        # First code
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codes",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": TestSetup.project_id,
                "name": "Support Experience",
                "definition": "References to support received from team members",
                "color": "#10B981",
                "code_type": "descriptive"
            }
        )
        assert response.status_code == 200, f"Create code 1 failed: {response.text}"
        TestSetup.code_id = response.json()["id"]
        print(f"Created code 1: {TestSetup.code_id}")
        
        # Second code for boolean/proximity queries
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codes",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": TestSetup.project_id,
                "name": "Improvement Feedback",
                "definition": "Suggestions for improvements to the program",
                "color": "#F59E0B",
                "code_type": "descriptive"
            }
        )
        assert response.status_code == 200, f"Create code 2 failed: {response.text}"
        TestSetup.second_code_id = response.json()["id"]
        print(f"Created code 2: {TestSetup.second_code_id}")
    
    def test_create_coding(self):
        """Create a coding for test data"""
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codings",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": TestSetup.project_id,
                "source_id": TestSetup.source_id,
                "code_id": TestSetup.code_id,
                "start_char": 200,
                "end_char": 350,
                "excerpt_text": "The program was very helpful. I found the support team, especially Sarah Johnson, to be incredibly patient.",
                "notes": "Positive support experience"
            }
        )
        
        assert response.status_code == 200, f"Create coding failed: {response.text}"
        TestSetup.coding_id = response.json()["id"]
        print(f"Created coding: {TestSetup.coding_id}")


# =============================================================================
# AI FEATURES TESTS (Phase 2 & 3)
# =============================================================================

class TestAICodingSuggestions:
    """Test AI-powered coding suggestions"""
    
    def test_suggest_codes(self):
        """Test AI coding suggestions for excerpt"""
        # Wait for setup
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/suggest-codes",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "source_id": TestSetup.source_id,
                "excerpt_text": "The support team was incredibly helpful and patient with my questions",
                "start_char": 200,
                "end_char": 280,
                "max_suggestions": 3
            }
        )
        
        assert response.status_code == 200, f"Suggest codes failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "suggestions" in data, "Response should have suggestions"
        assert "suggestion_count" in data, "Response should have suggestion_count"
        assert "excerpt" in data, "Response should have excerpt"
        
        print(f"AI Suggestions: {data['suggestion_count']} suggestions received")
        if data["suggestions"]:
            for sug in data["suggestions"]:
                print(f"  - {sug.get('code_name')}: {sug.get('confidence')}")
    
    def test_suggest_codes_empty_codebook(self):
        """Test suggestion behavior with no codes"""
        # Create a fresh project without codes
        proj_response = requests.post(
            f"{BASE_URL}/api/qualitative/projects",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={"name": "TEST_Empty_Codebook", "methodology": "grounded"}
        )
        assert proj_response.status_code == 200
        empty_proj_id = proj_response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/suggest-codes",
            params={
                "project_id": empty_proj_id,
                "org_id": TEST_ORG_ID,
                "source_id": TestSetup.source_id,
                "excerpt_text": "Some text to analyze",
                "start_char": 0,
                "end_char": 20
            }
        )
        
        assert response.status_code == 200, f"Suggest codes failed: {response.text}"
        data = response.json()
        assert data["suggestions"] == [], "Should return empty suggestions for empty codebook"
        assert "message" in data, "Should have message about no codes"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/qualitative/projects/{empty_proj_id}", params={"org_id": TEST_ORG_ID})
        print("Empty codebook test passed")


class TestPIIDetection:
    """Test PII detection endpoint"""
    
    def test_detect_pii_pattern_based(self):
        """Test pattern-based PII detection"""
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/detect-pii/{TestSetup.source_id}",
            params={"org_id": TEST_ORG_ID, "use_ai": False}
        )
        
        assert response.status_code == 200, f"Detect PII failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "source_id" in data, "Response should have source_id"
        assert "pii_count" in data, "Response should have pii_count"
        assert "findings" in data, "Response should have findings"
        assert "pii_types" in data, "Response should have pii_types"
        
        # Should detect email and phone
        pii_types = data["pii_types"]
        assert "email" in pii_types, f"Should detect email. Found types: {pii_types}"
        assert "phone" in pii_types, f"Should detect phone. Found types: {pii_types}"
        
        print(f"PII Detection found {data['pii_count']} items: {pii_types}")
        for finding in data["findings"][:5]:
            print(f"  - {finding['type']}: {finding['value'][:20]}...")
    
    def test_detect_pii_with_ai(self):
        """Test AI-enhanced PII detection (includes names)"""
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/detect-pii/{TestSetup.source_id}",
            params={"org_id": TEST_ORG_ID, "use_ai": True}
        )
        
        assert response.status_code == 200, f"Detect PII with AI failed: {response.text}"
        data = response.json()
        
        # With AI, should also detect names
        print(f"AI PII Detection found {data['pii_count']} items: {data['pii_types']}")


class TestAnonymization:
    """Test PII anonymization endpoint"""
    
    anonymized_source_id = None
    
    def test_create_source_for_anonymization(self):
        """Create a fresh source for anonymization (to preserve original test source)"""
        response = requests.post(
            f"{BASE_URL}/api/qualitative/sources",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID},
            json={
                "project_id": TestSetup.project_id,
                "name": "TEST_Anonymize_Source",
                "source_type": "transcript",
                "content": "My name is Alice Brown. Contact me at alice@test.com or 555-999-8888.",
                "language": "en"
            }
        )
        assert response.status_code == 200, f"Create source failed: {response.text}"
        TestAnonymization.anonymized_source_id = response.json()["id"]
        print(f"Created source for anonymization: {TestAnonymization.anonymized_source_id}")
    
    def test_anonymize_source(self):
        """Test anonymizing PII in a source"""
        source_id = TestAnonymization.anonymized_source_id
        assert source_id is not None, "Source not created"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/anonymize/{source_id}",
            params={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID}
        )
        
        assert response.status_code == 200, f"Anonymize failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert "anonymized" in data, "Response should have anonymized flag"
        assert "pii_replaced" in data, "Response should have pii_replaced count"
        assert "anonymization_map" in data, "Response should have anonymization_map"
        
        if data["anonymized"]:
            print(f"Anonymized {data['pii_replaced']} PII items")
            print(f"Map: {data['anonymization_map']}")
        else:
            print("No PII to anonymize")
    
    def test_verify_anonymization(self):
        """Verify the source content was anonymized"""
        source_id = TestAnonymization.anonymized_source_id
        if source_id is None:
            pytest.skip("Anonymization source not created")
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/sources/{source_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200
        data = response.json()
        content = data["content"]
        
        # Verify PII is replaced
        assert "alice@test.com" not in content.lower(), "Email should be anonymized"
        assert "555-999-8888" not in content, "Phone should be anonymized"
        
        # Should contain pseudonyms
        assert "[EMAIL" in content or "[PHONE" in content or "[PARTICIPANT" in content, \
            f"Content should have pseudonyms. Content: {content}"
        
        print(f"Verified anonymization. Content preview: {content[:100]}...")


class TestAutoCodeSource:
    """Test AI auto-coding of entire source"""
    
    def test_auto_code_source(self):
        """Test auto-coding a source with AI"""
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/auto-code-source/{TestSetup.source_id}",
            params={
                "org_id": TEST_ORG_ID,
                "user_id": TEST_USER_ID,
                "confidence_threshold": "high"
            }
        )
        
        assert response.status_code == 200, f"Auto-code failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert "source_id" in data, "Response should have source_id"
        assert "codings_created" in data, "Response should have codings_created"
        assert "message" in data, "Response should have message"
        
        print(f"Auto-coded source: {data['codings_created']} codings created")


class TestThemeSynthesis:
    """Test AI theme synthesis"""
    
    def test_synthesize_themes(self):
        """Test AI-powered theme synthesis from coded data"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/synthesize-themes",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "user_id": TEST_USER_ID,
                "min_codings": 1  # Lower threshold for testing
            }
        )
        
        assert response.status_code == 200, f"Synthesize themes failed: {response.text}"
        data = response.json()
        
        # Verify response
        assert "themes_created" in data, "Response should have themes_created"
        assert "themes" in data, "Response should have themes"
        assert "message" in data, "Response should have message"
        
        print(f"Theme synthesis: {data['themes_created']} themes created")
        if data["themes"]:
            for theme in data["themes"]:
                print(f"  - {theme.get('title')}")


class TestReportGeneration:
    """Test report generation endpoint"""
    
    def test_generate_json_report(self):
        """Test generating JSON format report"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/generate-report/{TestSetup.project_id}",
            params={
                "org_id": TEST_ORG_ID,
                "user_id": TEST_USER_ID,
                "include_themes": True,
                "include_quotes": True,
                "include_code_frequency": True,
                "format": "json"
            }
        )
        
        assert response.status_code == 200, f"Generate JSON report failed: {response.text}"
        data = response.json()
        
        assert "format" in data, "Response should have format"
        assert data["format"] == "json", "Format should be json"
        assert "content" in data, "Response should have content"
        
        report = data["content"]
        assert "title" in report, "Report should have title"
        assert "summary" in report, "Report should have summary"
        assert "project" in report, "Report should have project"
        
        print(f"JSON Report generated: {report['title']}")
        print(f"Summary: {report['summary']}")
    
    def test_generate_markdown_report(self):
        """Test generating Markdown format report"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/ai/generate-report/{TestSetup.project_id}",
            params={
                "org_id": TEST_ORG_ID,
                "user_id": TEST_USER_ID,
                "format": "markdown"
            }
        )
        
        assert response.status_code == 200, f"Generate MD report failed: {response.text}"
        data = response.json()
        
        assert data["format"] == "markdown"
        assert "content" in data
        assert "# " in data["content"], "Markdown should have headings"
        
        print(f"Markdown report generated, length: {len(data['content'])} chars")


class TestICRCalculation:
    """Test Inter-Coder Reliability calculation"""
    
    second_coder_id = "test-coder-2"
    
    def test_create_second_coder_codings(self):
        """Create codings from a second coder for ICR"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.source_id is not None, "Setup not complete"
        assert TestSetup.code_id is not None, "Setup not complete"
        
        # Create same region coded with same code (agreement)
        response = requests.post(
            f"{BASE_URL}/api/qualitative/codings",
            params={"org_id": TEST_ORG_ID, "user_id": TestICRCalculation.second_coder_id},
            json={
                "project_id": TestSetup.project_id,
                "source_id": TestSetup.source_id,
                "code_id": TestSetup.code_id,
                "start_char": 200,
                "end_char": 350,
                "excerpt_text": "The program was very helpful. I found the support team, especially Sarah Johnson, to be incredibly patient.",
                "notes": "Second coder - same code"
            }
        )
        
        assert response.status_code == 200, f"Create second coder coding failed: {response.text}"
        print("Created second coder coding for ICR")
    
    def test_calculate_icr(self):
        """Test ICR (Cohen's Kappa) calculation"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/ai/icr/{TestSetup.project_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Calculate ICR failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "project_id" in data, "Response should have project_id"
        
        if data.get("cohens_kappa") is not None:
            assert "coders_compared" in data, "Should have coders_compared"
            assert "agreements" in data, "Should have agreements"
            assert "disagreements" in data, "Should have disagreements"
            assert "interpretation" in data, "Should have interpretation"
            
            print(f"ICR Results:")
            print(f"  Cohen's Kappa: {data['cohens_kappa']}")
            print(f"  Interpretation: {data['interpretation']}")
            print(f"  Agreements: {data['agreements']}, Disagreements: {data['disagreements']}")
        else:
            print(f"ICR calculation note: {data.get('message', 'Insufficient data')}")


# =============================================================================
# COLLABORATION FEATURES TESTS (Phase 2)
# =============================================================================

class TestCoderAssignments:
    """Test coder assignment workflows"""
    
    assignment_id = None
    
    def test_create_assignment(self):
        """Test creating a coder assignment"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/collab/assignments",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "assigned_by": TEST_USER_ID
            },
            json={
                "source_id": TestSetup.source_id,
                "coder_id": "test-coder-assigned",
                "is_blind": True,
                "notes": "Test blind coding assignment"
            }
        )
        
        assert response.status_code == 200, f"Create assignment failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have id"
        TestCoderAssignments.assignment_id = data["id"]
        print(f"Created assignment: {TestCoderAssignments.assignment_id}")
    
    def test_list_assignments(self):
        """Test listing assignments"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/assignments",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID
            }
        )
        
        assert response.status_code == 200, f"List assignments failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} assignments")
    
    def test_update_assignment_status(self):
        """Test updating assignment status"""
        assignment_id = TestCoderAssignments.assignment_id
        if assignment_id is None:
            pytest.skip("Assignment not created")
        
        response = requests.patch(
            f"{BASE_URL}/api/qualitative/collab/assignments/{assignment_id}",
            params={
                "org_id": TEST_ORG_ID,
                "user_id": "test-coder-assigned",
                "status": "in_progress"
            }
        )
        
        assert response.status_code == 200, f"Update assignment failed: {response.text}"
        print("Assignment status updated to in_progress")


class TestBlindCoding:
    """Test blind coding mode"""
    
    def test_get_blind_source(self):
        """Test getting source content for blind coding"""
        source_id = TestSetup.source_id
        if source_id is None:
            pytest.skip("Source not created")
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/blind-source/{source_id}",
            params={
                "org_id": TEST_ORG_ID,
                "coder_id": "test-coder-assigned"  # Must match assignment
            }
        )
        
        assert response.status_code == 200, f"Get blind source failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have id"
        assert "content" in data, "Response should have content"
        assert "is_blind" in data, "Response should have is_blind flag"
        assert "codings" in data, "Response should have codings"
        
        print(f"Blind source retrieved. Is blind: {data['is_blind']}, Codings visible: {len(data['codings'])}")


class TestCodingReviews:
    """Test coding review workflow"""
    
    review_id = None
    
    def test_submit_for_review(self):
        """Test submitting codings for review"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.source_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/collab/reviews",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "coder_id": TEST_USER_ID,
                "source_id": TestSetup.source_id
            }
        )
        
        assert response.status_code == 200, f"Submit for review failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Response should have id"
        TestCodingReviews.review_id = data["id"]
        print(f"Submitted for review: {TestCodingReviews.review_id}")
    
    def test_list_reviews(self):
        """Test listing reviews"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/reviews",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID
            }
        )
        
        assert response.status_code == 200, f"List reviews failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} reviews")
    
    def test_complete_review(self):
        """Test completing a review"""
        review_id = TestCodingReviews.review_id
        if review_id is None:
            pytest.skip("Review not created")
        
        response = requests.patch(
            f"{BASE_URL}/api/qualitative/collab/reviews/{review_id}",
            params={
                "org_id": TEST_ORG_ID,
                "reviewer_id": "test-reviewer",
                "status": "approved",
                "reviewer_notes": "Good coding work"
            }
        )
        
        assert response.status_code == 200, f"Complete review failed: {response.text}"
        print("Review completed with status: approved")


class TestAuditTrail:
    """Test audit trail functionality"""
    
    def test_get_audit_trail(self):
        """Test getting project audit trail"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/audit-trail/{TestSetup.project_id}",
            params={"org_id": TEST_ORG_ID, "limit": 50}
        )
        
        assert response.status_code == 200, f"Get audit trail failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Audit trail has {len(data)} entries")
        
        if data:
            entry = data[0]
            assert "action" in entry, "Entry should have action"
            assert "entity_type" in entry, "Entry should have entity_type"
            assert "timestamp" in entry, "Entry should have timestamp"
            print(f"  Latest: {entry['action']} on {entry['entity_type']}")
    
    def test_get_entity_history(self):
        """Test getting history for specific entity"""
        assignment_id = TestCoderAssignments.assignment_id
        if assignment_id is None:
            pytest.skip("Assignment not created")
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/audit-trail/entity/assignment/{assignment_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get entity history failed: {response.text}"
        data = response.json()
        
        assert "entity_type" in data, "Response should have entity_type"
        assert "entity_id" in data, "Response should have entity_id"
        assert "history" in data, "Response should have history"
        
        print(f"Entity history: {data['history_count']} events")


class TestCodeVersions:
    """Test code version history"""
    
    def test_save_code_version(self):
        """Test saving a code version"""
        code_id = TestSetup.code_id
        if code_id is None:
            pytest.skip("Code not created")
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/collab/codes/{code_id}/versions",
            params={
                "org_id": TEST_ORG_ID,
                "user_id": TEST_USER_ID
            }
        )
        
        assert response.status_code == 200, f"Save code version failed: {response.text}"
        data = response.json()
        
        assert "version" in data, "Response should have version number"
        print(f"Saved code version: {data['version']}")
    
    def test_get_code_versions(self):
        """Test getting code version history"""
        code_id = TestSetup.code_id
        if code_id is None:
            pytest.skip("Code not created")
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/collab/codes/{code_id}/versions",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Get code versions failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"Code has {len(data)} versions")


# =============================================================================
# ADVANCED QUERY TESTS (Phase 2)
# =============================================================================

class TestBooleanQueries:
    """Test boolean query functionality"""
    
    def test_boolean_or_query(self):
        """Test OR boolean query"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.code_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/boolean",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "code_ids": [TestSetup.code_id],
                "operator": "OR"
            }
        )
        
        assert response.status_code == 200, f"Boolean OR query failed: {response.text}"
        data = response.json()
        
        assert "operator" in data, "Response should have operator"
        assert data["operator"] == "OR", "Operator should be OR"
        assert "result_count" in data, "Response should have result_count"
        assert "results" in data, "Response should have results"
        
        print(f"Boolean OR query: {data['result_count']} results")
    
    def test_boolean_and_query(self):
        """Test AND boolean query with multiple codes"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.code_id is not None, "Setup not complete"
        assert TestSetup.second_code_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/boolean",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "code_ids": [TestSetup.code_id, TestSetup.second_code_id],
                "operator": "AND"
            }
        )
        
        assert response.status_code == 200, f"Boolean AND query failed: {response.text}"
        data = response.json()
        
        assert data["operator"] == "AND"
        print(f"Boolean AND query: {data['result_count']} results")
    
    def test_boolean_not_query(self):
        """Test NOT boolean query"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.code_id is not None, "Setup not complete"
        assert TestSetup.second_code_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/boolean",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "code_ids": [TestSetup.code_id],
                "operator": "NOT",
                "exclude_codes": [TestSetup.second_code_id]
            }
        )
        
        assert response.status_code == 200, f"Boolean NOT query failed: {response.text}"
        data = response.json()
        
        assert data["operator"] == "NOT"
        assert "exclude_codes" in data
        print(f"Boolean NOT query: {data['result_count']} results")


class TestProximitySearch:
    """Test proximity search functionality"""
    
    def test_proximity_search(self):
        """Test proximity search between codes"""
        assert TestSetup.project_id is not None, "Setup not complete"
        assert TestSetup.code_id is not None, "Setup not complete"
        assert TestSetup.second_code_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/proximity",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "code_id_1": TestSetup.code_id,
                "code_id_2": TestSetup.second_code_id,
                "max_distance": 500
            }
        )
        
        assert response.status_code == 200, f"Proximity search failed: {response.text}"
        data = response.json()
        
        assert "code_1" in data, "Response should have code_1"
        assert "code_2" in data, "Response should have code_2"
        assert "max_distance" in data, "Response should have max_distance"
        assert "result_count" in data, "Response should have result_count"
        assert "results" in data, "Response should have results"
        
        print(f"Proximity search: {data['result_count']} pairs within {data['max_distance']} chars")


class TestMatrixCodingQuery:
    """Test matrix coding query functionality"""
    
    def test_matrix_query(self):
        """Test matrix coding query"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/matrix",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "row_attribute": "site"  # Group by site attribute
            }
        )
        
        assert response.status_code == 200, f"Matrix query failed: {response.text}"
        data = response.json()
        
        assert "row_attribute" in data, "Response should have row_attribute"
        assert "columns" in data, "Response should have columns (codes)"
        assert "matrix" in data, "Response should have matrix data"
        assert "column_totals" in data, "Response should have column_totals"
        
        print(f"Matrix query results:")
        print(f"  Row attribute: {data['row_attribute']}")
        print(f"  Columns (codes): {data['columns']}")
        print(f"  Grand total: {data.get('grand_total', 0)}")


class TestCrossCaseComparison:
    """Test cross-case comparison functionality"""
    
    def test_cross_case_comparison(self):
        """Test cross-case comparison"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.post(
            f"{BASE_URL}/api/qualitative/query/cross-case",
            params={
                "project_id": TestSetup.project_id,
                "org_id": TEST_ORG_ID,
                "compare_attribute": "participant_type"
            }
        )
        
        assert response.status_code == 200, f"Cross-case comparison failed: {response.text}"
        data = response.json()
        
        assert "compare_attribute" in data, "Response should have compare_attribute"
        assert "groups" in data, "Response should have groups"
        assert "comparison" in data, "Response should have comparison data"
        
        print(f"Cross-case comparison:")
        print(f"  Attribute: {data['compare_attribute']}")
        print(f"  Groups: {data['groups']}")


class TestCodeFrequencyAnalysis:
    """Test code frequency analysis"""
    
    def test_code_frequency(self):
        """Test code frequency analysis"""
        assert TestSetup.project_id is not None, "Setup not complete"
        
        response = requests.get(
            f"{BASE_URL}/api/qualitative/query/code-frequency/{TestSetup.project_id}",
            params={"org_id": TEST_ORG_ID}
        )
        
        assert response.status_code == 200, f"Code frequency failed: {response.text}"
        data = response.json()
        
        assert "project_id" in data, "Response should have project_id"
        assert "total_codings" in data, "Response should have total_codings"
        assert "total_codes_used" in data, "Response should have total_codes_used"
        assert "frequencies" in data, "Response should have frequencies"
        
        print(f"Code frequency analysis:")
        print(f"  Total codings: {data['total_codings']}")
        print(f"  Codes used: {data['total_codes_used']}")
        
        if data["frequencies"]:
            print("  Top codes:")
            for freq in data["frequencies"][:3]:
                print(f"    - {freq['code_name']}: {freq['count']} ({freq['percentage']}%)")


# =============================================================================
# CLEANUP
# =============================================================================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_anonymization_source(self):
        """Delete anonymization test source"""
        source_id = TestAnonymization.anonymized_source_id
        if source_id:
            response = requests.delete(
                f"{BASE_URL}/api/qualitative/sources/{source_id}",
                params={"org_id": TEST_ORG_ID}
            )
            if response.status_code == 200:
                print(f"Deleted anonymization source: {source_id}")
    
    def test_cleanup_codes(self):
        """Delete test codes"""
        for code_id in [TestSetup.second_code_id, TestSetup.code_id]:
            if code_id:
                requests.delete(
                    f"{BASE_URL}/api/qualitative/codes/{code_id}",
                    params={"org_id": TEST_ORG_ID}
                )
        print("Deleted test codes")
    
    def test_cleanup_source(self):
        """Delete test source"""
        source_id = TestSetup.source_id
        if source_id:
            requests.delete(
                f"{BASE_URL}/api/qualitative/sources/{source_id}",
                params={"org_id": TEST_ORG_ID}
            )
            print(f"Deleted test source: {source_id}")
    
    def test_cleanup_project(self):
        """Delete test project"""
        project_id = TestSetup.project_id
        if project_id:
            requests.delete(
                f"{BASE_URL}/api/qualitative/projects/{project_id}",
                params={"org_id": TEST_ORG_ID}
            )
            print(f"Deleted test project: {project_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
