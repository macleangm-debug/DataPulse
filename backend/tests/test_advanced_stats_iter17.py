"""
Phase 2 Advanced Statistics Module Tests - Iteration 17
Tests T-Test, ANOVA, Correlation, and Regression endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER = "test@datapulse.io"
TEST_PASSWORD = "password123"
ORG_ID = "ad326e2a-f7a4-4b3f-b4d2-0e1ba0fd9fbd"
FORM_ID = "124427aa-d482-4292-af6e-2042ae5cabbd"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ==================== ANOVA Tests ====================

class TestANOVA:
    """Tests for ANOVA endpoint - /api/statistics/anova"""
    
    def test_anova_with_post_hoc(self, api_client):
        """Test ANOVA with post-hoc Tukey tests"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/anova",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "satisfaction",
                "factor_var": "gender",
                "post_hoc": True
            }
        )
        
        assert response.status_code == 200, f"ANOVA failed: {response.text}"
        data = response.json()
        
        # Verify ANOVA structure
        assert "anova" in data, "Missing ANOVA results"
        assert "f_statistic" in data["anova"], "Missing F-statistic"
        assert "p_value" in data["anova"], "Missing p-value"
        assert "significant" in data["anova"], "Missing significance flag"
        
        # Verify group statistics
        assert "group_statistics" in data, "Missing group statistics"
        assert "n_groups" in data, "Missing n_groups"
        assert data["n_groups"] >= 2, "Should have at least 2 groups"
        
        # Verify effect size
        assert "effect_size" in data, "Missing effect size"
        assert "eta_squared" in data["effect_size"], "Missing eta-squared"
        assert "interpretation" in data["effect_size"], "Missing interpretation"
        
        # Verify post-hoc tests (should be present for 3+ groups)
        if data["n_groups"] > 2:
            assert "post_hoc_tukey" in data, "Missing post-hoc Tukey tests"
            assert len(data["post_hoc_tukey"]) > 0, "Post-hoc results empty"
            
            # Check post-hoc structure
            for comparison in data["post_hoc_tukey"]:
                assert "group_a" in comparison
                assert "group_b" in comparison
                assert "mean_diff" in comparison
                assert "p_value" in comparison
                assert "significant" in comparison
    
    def test_anova_without_post_hoc(self, api_client):
        """Test ANOVA without post-hoc tests"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/anova",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "satisfaction",
                "factor_var": "gender",
                "post_hoc": False
            }
        )
        
        assert response.status_code == 200, f"ANOVA failed: {response.text}"
        data = response.json()
        
        # Should still have ANOVA results but no post-hoc
        assert "anova" in data
        assert "f_statistic" in data["anova"]
    
    def test_anova_missing_variable(self, api_client):
        """Test ANOVA with missing variable"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/anova",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "nonexistent_var",
                "factor_var": "gender",
                "post_hoc": True
            }
        )
        
        assert response.status_code == 400, "Should reject missing variable"


# ==================== Correlation Tests ====================

class TestCorrelation:
    """Tests for Correlation endpoint - /api/statistics/correlation"""
    
    def test_pearson_correlation(self, api_client):
        """Test Pearson correlation matrix"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/correlation",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["satisfaction", "age"],
                "method": "pearson"
            }
        )
        
        assert response.status_code == 200, f"Correlation failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert data["method"] == "pearson"
        assert "n" in data
        assert "variables" in data
        assert len(data["variables"]) >= 2
        
        # Verify correlation matrix
        assert "correlation_matrix" in data
        for var in data["variables"]:
            assert var in data["correlation_matrix"]
        
        # Verify p-value matrix
        assert "p_value_matrix" in data
        
        # Verify pairwise correlations
        assert "pairwise_correlations" in data
        for pair in data["pairwise_correlations"]:
            assert "var1" in pair
            assert "var2" in pair
            assert "correlation" in pair
            assert "p_value" in pair
            assert "significant" in pair
    
    def test_spearman_correlation(self, api_client):
        """Test Spearman correlation"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/correlation",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["satisfaction", "age"],
                "method": "spearman"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["method"] == "spearman"
    
    def test_kendall_correlation(self, api_client):
        """Test Kendall tau correlation"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/correlation",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["satisfaction", "age"],
                "method": "kendall"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["method"] == "kendall"
    
    def test_correlation_requires_two_variables(self, api_client):
        """Test that correlation requires at least 2 variables"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/correlation",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["satisfaction"],
                "method": "pearson"
            }
        )
        
        assert response.status_code == 400, "Should require at least 2 variables"


# ==================== Regression Tests ====================

class TestRegression:
    """Tests for Regression endpoint - /api/statistics/regression"""
    
    def test_ols_regression(self, api_client):
        """Test OLS regression with R-squared and coefficients"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/regression",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "satisfaction",
                "independent_vars": ["age"],
                "model_type": "ols",
                "robust_se": False
            }
        )
        
        assert response.status_code == 200, f"Regression failed: {response.text}"
        data = response.json()
        
        # Verify model info
        assert data["model_type"] == "ols"
        assert data["dependent_variable"] == "satisfaction"
        assert "age" in data["independent_variables"]
        
        # Verify model fit statistics
        assert "model_fit" in data
        model_fit = data["model_fit"]
        assert "r_squared" in model_fit, "Missing R-squared"
        assert "r_squared_adj" in model_fit, "Missing Adj R-squared"
        assert "f_statistic" in model_fit, "Missing F-statistic"
        assert "f_p_value" in model_fit, "Missing F p-value"
        assert "aic" in model_fit, "Missing AIC"
        assert "bic" in model_fit, "Missing BIC"
        assert "n_observations" in model_fit
        
        # Verify coefficients table
        assert "coefficients" in data
        assert len(data["coefficients"]) >= 2  # const + at least 1 variable
        
        for coef in data["coefficients"]:
            assert "variable" in coef
            assert "coefficient" in coef
            assert "std_error" in coef
            assert "p_value" in coef
            assert "significant" in coef
            assert "ci_95" in coef
            assert len(coef["ci_95"]) == 2  # lower and upper
    
    def test_ols_regression_robust_se(self, api_client):
        """Test OLS with robust standard errors"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/regression",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "satisfaction",
                "independent_vars": ["age"],
                "model_type": "ols",
                "robust_se": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["robust_standard_errors"] == True
    
    def test_regression_missing_dependent(self, api_client):
        """Test regression with missing dependent variable"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/regression",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "dependent_var": "nonexistent_var",
                "independent_vars": ["age"],
                "model_type": "ols"
            }
        )
        
        assert response.status_code == 400, "Should reject missing variable"


# ==================== T-Test Tests ====================

class TestTTest:
    """Tests for T-Test endpoint - /api/statistics/ttest"""
    
    def test_one_sample_ttest(self, api_client):
        """Test one-sample t-test"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/ttest",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "one_sample",
                "variable": "satisfaction",
                "mu": 5
            }
        )
        
        assert response.status_code == 200, f"T-test failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert data["test_type"] == "one_sample"
        assert data["variable"] == "satisfaction"
        assert data["hypothesized_mean"] == 5
        assert "sample_mean" in data
        assert "sample_std" in data
        assert "n" in data
        assert "t_statistic" in data
        assert "p_value" in data
        assert "significant" in data
        assert "confidence_interval" in data
        assert "lower" in data["confidence_interval"]
        assert "upper" in data["confidence_interval"]
    
    def test_independent_ttest_requires_two_groups(self, api_client):
        """Test that independent t-test requires exactly 2 groups"""
        # Gender has 3 groups (male, female, other), should fail
        response = api_client.post(
            f"{BASE_URL}/api/statistics/ttest",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "independent",
                "variable": "satisfaction",
                "group_var": "gender"
            }
        )
        
        assert response.status_code == 400, "Should reject when not exactly 2 groups"
        data = response.json()
        assert "2 groups" in data.get("detail", ""), "Should mention 2 groups requirement"
    
    def test_independent_ttest_missing_group_var(self, api_client):
        """Test independent t-test without group variable"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/ttest",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "test_type": "independent",
                "variable": "satisfaction"
            }
        )
        
        assert response.status_code == 400, "Should require group variable"


# ==================== Descriptives Tests ====================

class TestDescriptives:
    """Tests for Descriptives endpoint - /api/statistics/descriptives"""
    
    def test_descriptives_with_normality(self, api_client):
        """Test descriptive statistics with normality tests"""
        response = api_client.post(
            f"{BASE_URL}/api/statistics/descriptives",
            json={
                "form_id": FORM_ID,
                "org_id": ORG_ID,
                "variables": ["satisfaction", "age"],
                "include_normality": True,
                "percentiles": [25, 50, 75]
            }
        )
        
        assert response.status_code == 200, f"Descriptives failed: {response.text}"
        data = response.json()
        
        assert "total_n" in data
        assert "variables" in data
        assert len(data["variables"]) >= 1
        
        for var_stats in data["variables"]:
            assert "variable" in var_stats
            assert "n" in var_stats
            assert "mean" in var_stats
            assert "std" in var_stats
            assert "min" in var_stats
            assert "max" in var_stats
            assert "percentiles" in var_stats


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
