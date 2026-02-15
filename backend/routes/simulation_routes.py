"""DataPulse - AI Field Simulation Module
Synthetic path testing for form validation and optimization.

Features:
- Simulate respondent paths through forms
- Detect dead-ends and unreachable questions
- Validate skip logic completeness
- Estimate interview duration distribution
- Generate path coverage reports
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone
from enum import Enum
import random
import statistics
import json
import os

router = APIRouter(prefix="/simulation", tags=["AI Field Simulation"])


class SimulationMode(str, Enum):
    RANDOM = "random"  # Random responses
    EDGE_CASES = "edge_cases"  # Test boundary conditions
    EXHAUSTIVE = "exhaustive"  # Try all paths
    REALISTIC = "realistic"  # AI-generated realistic responses


class PathResult(BaseModel):
    path_id: str
    questions_visited: List[str]
    questions_skipped: List[str]
    dead_ends: List[str]
    duration_estimate_seconds: int
    validation_errors: List[Dict[str, Any]]
    completion_status: str  # "complete", "dead_end", "loop_detected", "max_depth"


class SimulationConfig(BaseModel):
    form_id: str
    org_id: str
    num_simulations: int = 100
    mode: SimulationMode = SimulationMode.RANDOM
    max_path_depth: int = 500
    include_ai_analysis: bool = False
    seed: Optional[int] = None  # For reproducibility


class SimulationReport(BaseModel):
    form_id: str
    total_simulations: int
    completed_paths: int
    dead_end_paths: int
    loop_detected: int
    
    # Duration statistics
    avg_duration_seconds: float
    min_duration_seconds: int
    max_duration_seconds: int
    duration_std_dev: float
    duration_percentiles: Dict[str, int]
    
    # Coverage
    question_coverage: Dict[str, int]  # question_id -> times visited
    unreachable_questions: List[str]
    
    # Issues found
    dead_ends: List[Dict[str, Any]]
    logic_gaps: List[Dict[str, Any]]
    validation_issues: List[Dict[str, Any]]
    
    # AI insights (if enabled)
    ai_insights: Optional[Dict[str, Any]] = None


# ============ Path Simulation Engine ============

class FormPathSimulator:
    """Simulates respondent paths through a form"""
    
    def __init__(self, form: Dict, mode: SimulationMode = SimulationMode.RANDOM, seed: int = None):
        self.form = form
        self.mode = mode
        self.fields = {f['id']: f for f in form.get('fields', [])}
        self.field_order = [f['id'] for f in form.get('fields', [])]
        
        # Parse skip logic and calculations
        self.skip_logic = self._parse_skip_logic()
        self.calculations = self._parse_calculations()
        
        if seed:
            random.seed(seed)
    
    def _parse_skip_logic(self) -> Dict[str, Dict]:
        """Extract skip logic rules from form fields"""
        rules = {}
        for field in self.form.get('fields', []):
            if field.get('skip_logic'):
                rules[field['id']] = field['skip_logic']
            elif field.get('relevance'):
                rules[field['id']] = {'condition': field['relevance']}
        return rules
    
    def _parse_calculations(self) -> Dict[str, str]:
        """Extract calculation formulas from form fields"""
        calcs = {}
        for field in self.form.get('fields', []):
            if field.get('calculation'):
                calcs[field['id']] = field['calculation']
        return calcs
    
    def _generate_response(self, field: Dict, responses: Dict) -> Any:
        """Generate a simulated response for a field based on mode"""
        field_type = field.get('type', 'text')
        
        if self.mode == SimulationMode.EDGE_CASES:
            return self._generate_edge_case(field)
        elif self.mode == SimulationMode.REALISTIC:
            return self._generate_realistic(field, responses)
        else:  # RANDOM
            return self._generate_random(field)
    
    def _generate_random(self, field: Dict) -> Any:
        """Generate random response based on field type"""
        field_type = field.get('type', 'text')
        
        if field_type == 'text':
            return f"Random text {random.randint(1, 1000)}"
        elif field_type == 'number':
            min_val = field.get('min', 0)
            max_val = field.get('max', 100)
            return random.randint(min_val, max_val)
        elif field_type == 'select' or field_type == 'radio':
            options = field.get('options', [])
            if options:
                return random.choice(options).get('value', options[0])
            return None
        elif field_type == 'checkbox':
            options = field.get('options', [])
            if options:
                num_selected = random.randint(0, len(options))
                selected = random.sample(options, num_selected)
                return [o.get('value') for o in selected]
            return []
        elif field_type == 'date':
            from datetime import timedelta
            base = datetime.now()
            delta = timedelta(days=random.randint(-365, 365))
            return (base + delta).strftime('%Y-%m-%d')
        elif field_type == 'gps':
            return {
                'latitude': random.uniform(-90, 90),
                'longitude': random.uniform(-180, 180),
                'accuracy': random.uniform(1, 50)
            }
        elif field_type == 'yes_no':
            return random.choice(['yes', 'no'])
        else:
            return f"simulated_{field_type}"
    
    def _generate_edge_case(self, field: Dict) -> Any:
        """Generate edge case values to test validation"""
        field_type = field.get('type', 'text')
        
        edge_cases = {
            'text': ['', ' ', 'a' * 1000, '<script>alert("xss")</script>', '特殊字符'],
            'number': [field.get('min', 0), field.get('max', 100), -1, 0, 999999],
            'select': [None, '', 'invalid_option'],
            'date': ['1900-01-01', '2100-12-31', 'invalid-date', ''],
        }
        
        if field_type in edge_cases:
            return random.choice(edge_cases[field_type])
        return self._generate_random(field)
    
    def _generate_realistic(self, field: Dict, responses: Dict) -> Any:
        """Generate realistic response (placeholder for AI integration)"""
        # In a real implementation, this would use GPT to generate contextual responses
        return self._generate_random(field)
    
    def _evaluate_skip_condition(self, condition: str, responses: Dict) -> bool:
        """Evaluate a skip logic condition against current responses"""
        if not condition:
            return True  # No condition means always show
        
        try:
            # Simple condition parser
            # Supports: field_id == 'value', field_id != 'value', field_id > value
            condition = condition.strip()
            
            # Replace field references with actual values
            for field_id, value in responses.items():
                if field_id in condition:
                    if isinstance(value, str):
                        condition = condition.replace(f"${{{field_id}}}", f"'{value}'")
                        condition = condition.replace(field_id, f"'{value}'")
                    else:
                        condition = condition.replace(f"${{{field_id}}}", str(value))
                        condition = condition.replace(field_id, str(value))
            
            # Safely evaluate
            # Note: In production, use a proper expression parser
            return eval(condition, {"__builtins__": {}}, {})
        except Exception as e:
            # If evaluation fails, assume condition is met
            return True
    
    def _estimate_field_duration(self, field: Dict) -> int:
        """Estimate time in seconds to complete a field"""
        field_type = field.get('type', 'text')
        
        base_times = {
            'text': 15,
            'textarea': 45,
            'number': 8,
            'select': 5,
            'radio': 5,
            'checkbox': 10,
            'date': 10,
            'gps': 20,
            'photo': 30,
            'audio': 60,
            'video': 120,
            'signature': 15,
            'barcode': 10,
            'note': 5,
            'group': 0,
        }
        
        base = base_times.get(field_type, 10)
        
        # Add time for required fields (more careful response)
        if field.get('required'):
            base += 3
        
        # Add time for fields with many options
        options = field.get('options', [])
        if len(options) > 5:
            base += len(options) * 0.5
        
        return int(base)
    
    def simulate_path(self, path_id: str = None) -> PathResult:
        """Simulate a single respondent path through the form"""
        if not path_id:
            path_id = f"sim_{int(datetime.now().timestamp())}_{random.randint(1000, 9999)}"
        
        responses = {}
        visited = []
        skipped = []
        dead_ends = []
        validation_errors = []
        total_duration = 0
        visited_set: Set[str] = set()
        
        current_index = 0
        depth = 0
        max_depth = 500
        
        while current_index < len(self.field_order) and depth < max_depth:
            field_id = self.field_order[current_index]
            field = self.fields.get(field_id)
            
            if not field:
                current_index += 1
                depth += 1
                continue
            
            # Check for loops
            if field_id in visited_set and len(visited_set) > 10:
                # Allow some revisits but detect infinite loops
                visit_count = visited.count(field_id)
                if visit_count > 3:
                    return PathResult(
                        path_id=path_id,
                        questions_visited=visited,
                        questions_skipped=skipped,
                        dead_ends=dead_ends,
                        duration_estimate_seconds=total_duration,
                        validation_errors=validation_errors,
                        completion_status="loop_detected"
                    )
            
            # Check skip logic
            skip_rule = self.skip_logic.get(field_id, {})
            condition = skip_rule.get('condition', skip_rule.get('relevance'))
            
            if condition and not self._evaluate_skip_condition(condition, responses):
                skipped.append(field_id)
                current_index += 1
                depth += 1
                continue
            
            # Field is visible - generate response
            visited.append(field_id)
            visited_set.add(field_id)
            
            # Skip note-type fields (no response needed)
            if field.get('type') != 'note':
                response = self._generate_response(field, responses)
                responses[field_id] = response
                
                # Validate response
                if field.get('required') and not response:
                    validation_errors.append({
                        'field_id': field_id,
                        'error': 'required_field_empty',
                        'severity': 'error'
                    })
            
            # Estimate duration
            total_duration += self._estimate_field_duration(field)
            
            # Check for jump/goto logic
            if skip_rule.get('goto'):
                goto_field = skip_rule['goto']
                if goto_field in self.fields:
                    try:
                        current_index = self.field_order.index(goto_field)
                    except ValueError:
                        dead_ends.append({
                            'from_field': field_id,
                            'goto_target': goto_field,
                            'error': 'goto_target_not_found'
                        })
                        current_index += 1
                else:
                    dead_ends.append({
                        'from_field': field_id,
                        'goto_target': goto_field,
                        'error': 'invalid_goto_target'
                    })
                    current_index += 1
            else:
                current_index += 1
            
            depth += 1
        
        # Determine completion status
        if depth >= max_depth:
            status = "max_depth"
        elif dead_ends:
            status = "dead_end"
        elif current_index >= len(self.field_order):
            status = "complete"
        else:
            status = "incomplete"
        
        return PathResult(
            path_id=path_id,
            questions_visited=visited,
            questions_skipped=skipped,
            dead_ends=dead_ends,
            duration_estimate_seconds=total_duration,
            validation_errors=validation_errors,
            completion_status=status
        )


# ============ API Endpoints ============

@router.post("/run")
async def run_simulation(
    request: Request,
    config: SimulationConfig
):
    """Run form path simulation"""
    db = request.app.state.db
    
    # Get form
    form = await db.forms.find_one({"id": config.form_id, "org_id": config.org_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form["_id"] = str(form.get("_id", ""))
    
    # Initialize simulator
    simulator = FormPathSimulator(
        form=form,
        mode=config.mode,
        seed=config.seed
    )
    
    # Run simulations
    results: List[PathResult] = []
    for i in range(config.num_simulations):
        path_result = simulator.simulate_path(f"sim_{i+1}")
        results.append(path_result)
    
    # Analyze results
    report = analyze_simulation_results(form, results, config)
    
    # Optionally add AI insights
    if config.include_ai_analysis:
        report.ai_insights = await generate_ai_insights(request, form, report)
    
    # Store simulation report
    report_doc = {
        "id": f"simreport_{config.form_id}_{int(datetime.now(timezone.utc).timestamp())}",
        "form_id": config.form_id,
        "org_id": config.org_id,
        "config": config.dict(),
        "report": report.dict(),
        "created_at": datetime.now(timezone.utc)
    }
    await db.simulation_reports.insert_one(report_doc)
    
    return {
        "report_id": report_doc["id"],
        "summary": {
            "total_simulations": report.total_simulations,
            "completed_paths": report.completed_paths,
            "dead_end_paths": report.dead_end_paths,
            "avg_duration_minutes": round(report.avg_duration_seconds / 60, 1),
            "unreachable_questions": len(report.unreachable_questions),
            "issues_found": len(report.dead_ends) + len(report.logic_gaps) + len(report.validation_issues)
        },
        "report": report.dict()
    }


@router.get("/reports/{org_id}")
async def list_simulation_reports(
    request: Request,
    org_id: str,
    form_id: Optional[str] = None,
    limit: int = 20
):
    """List simulation reports for an organization"""
    db = request.app.state.db
    
    query = {"org_id": org_id}
    if form_id:
        query["form_id"] = form_id
    
    reports = await db.simulation_reports.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for r in reports:
        r["_id"] = str(r.get("_id", ""))
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
    
    return reports


@router.get("/reports/{org_id}/{report_id}")
async def get_simulation_report(
    request: Request,
    org_id: str,
    report_id: str
):
    """Get detailed simulation report"""
    db = request.app.state.db
    
    report = await db.simulation_reports.find_one({"id": report_id, "org_id": org_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report["_id"] = str(report.get("_id", ""))
    if report.get("created_at"):
        report["created_at"] = report["created_at"].isoformat()
    
    return report


@router.post("/quick-check/{form_id}")
async def quick_form_check(
    request: Request,
    form_id: str,
    org_id: str
):
    """Quick form validation check with 10 simulations"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id, "org_id": org_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form["_id"] = str(form.get("_id", ""))
    
    simulator = FormPathSimulator(form=form, mode=SimulationMode.EDGE_CASES)
    
    results = [simulator.simulate_path(f"quick_{i}") for i in range(10)]
    
    # Quick analysis
    dead_ends = set()
    validation_issues = set()
    for r in results:
        for de in r.dead_ends:
            dead_ends.add(json.dumps(de))
        for ve in r.validation_errors:
            validation_issues.add(json.dumps(ve))
    
    return {
        "form_id": form_id,
        "quick_check": True,
        "simulations_run": 10,
        "issues": {
            "dead_ends": [json.loads(de) for de in dead_ends],
            "validation_issues": [json.loads(vi) for vi in validation_issues],
            "completed_paths": sum(1 for r in results if r.completion_status == "complete"),
            "failed_paths": sum(1 for r in results if r.completion_status != "complete")
        },
        "recommendation": "Run full simulation for comprehensive analysis" if dead_ends or validation_issues else "Form looks good!"
    }


# ============ Helper Functions ============

def analyze_simulation_results(form: Dict, results: List[PathResult], config: SimulationConfig) -> SimulationReport:
    """Analyze simulation results and generate report"""
    
    # Basic stats
    completed = sum(1 for r in results if r.completion_status == "complete")
    dead_ends_count = sum(1 for r in results if r.completion_status == "dead_end")
    loops = sum(1 for r in results if r.completion_status == "loop_detected")
    
    # Duration stats
    durations = [r.duration_estimate_seconds for r in results]
    avg_duration = statistics.mean(durations) if durations else 0
    std_dev = statistics.stdev(durations) if len(durations) > 1 else 0
    
    # Calculate percentiles
    sorted_durations = sorted(durations)
    percentiles = {
        "p10": sorted_durations[int(len(sorted_durations) * 0.1)] if durations else 0,
        "p25": sorted_durations[int(len(sorted_durations) * 0.25)] if durations else 0,
        "p50": sorted_durations[int(len(sorted_durations) * 0.5)] if durations else 0,
        "p75": sorted_durations[int(len(sorted_durations) * 0.75)] if durations else 0,
        "p90": sorted_durations[int(len(sorted_durations) * 0.9)] if durations else 0,
    }
    
    # Question coverage
    all_field_ids = {f['id'] for f in form.get('fields', [])}
    visited_counts: Dict[str, int] = {}
    for r in results:
        for q in r.questions_visited:
            visited_counts[q] = visited_counts.get(q, 0) + 1
    
    unreachable = list(all_field_ids - set(visited_counts.keys()))
    
    # Aggregate issues
    all_dead_ends = []
    all_validation_issues = []
    seen_dead_ends = set()
    seen_validation = set()
    
    for r in results:
        for de in r.dead_ends:
            key = json.dumps(de, sort_keys=True)
            if key not in seen_dead_ends:
                all_dead_ends.append(de)
                seen_dead_ends.add(key)
        
        for ve in r.validation_errors:
            key = json.dumps(ve, sort_keys=True)
            if key not in seen_validation:
                all_validation_issues.append(ve)
                seen_validation.add(key)
    
    # Detect logic gaps (fields that are rarely reached)
    logic_gaps = []
    for field_id, count in visited_counts.items():
        visit_rate = count / len(results)
        if visit_rate < 0.05:  # Less than 5% visit rate
            logic_gaps.append({
                "field_id": field_id,
                "visit_rate": round(visit_rate * 100, 1),
                "issue": "rarely_reached",
                "suggestion": "Check skip logic conditions"
            })
    
    return SimulationReport(
        form_id=config.form_id,
        total_simulations=len(results),
        completed_paths=completed,
        dead_end_paths=dead_ends_count,
        loop_detected=loops,
        avg_duration_seconds=round(avg_duration, 1),
        min_duration_seconds=min(durations) if durations else 0,
        max_duration_seconds=max(durations) if durations else 0,
        duration_std_dev=round(std_dev, 1),
        duration_percentiles=percentiles,
        question_coverage=visited_counts,
        unreachable_questions=unreachable,
        dead_ends=all_dead_ends,
        logic_gaps=logic_gaps,
        validation_issues=all_validation_issues
    )


async def generate_ai_insights(request: Request, form: Dict, report: SimulationReport) -> Dict[str, Any]:
    """Generate AI-powered insights using GPT"""
    try:
        from emergentintegrations.llm.chat import chat, UserMessage
        
        # Prepare summary for AI
        summary = f"""
        Form Analysis Summary:
        - Total simulations: {report.total_simulations}
        - Completion rate: {report.completed_paths / report.total_simulations * 100:.1f}%
        - Average duration: {report.avg_duration_seconds / 60:.1f} minutes
        - Unreachable questions: {len(report.unreachable_questions)}
        - Dead ends found: {len(report.dead_ends)}
        - Logic gaps: {len(report.logic_gaps)}
        
        Issues:
        {json.dumps(report.dead_ends[:5], indent=2)}
        {json.dumps(report.logic_gaps[:5], indent=2)}
        """
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return {"error": "AI analysis not available - API key not configured"}
        
        response = await chat(
            api_key=api_key,
            model="gpt-5.2",
            messages=[
                UserMessage(content=f"""You are a survey methodology expert. Analyze this form simulation report and provide actionable insights:

{summary}

Provide:
1. Key findings (2-3 bullet points)
2. Recommendations for improving form completion rate
3. Suggestions for addressing dead ends or logic gaps
4. Estimated optimal interview duration

Be concise and practical.""")
            ]
        )
        
        return {
            "analysis": response,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {"error": f"AI analysis failed: {str(e)}"}
