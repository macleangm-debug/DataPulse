"""DataPulse - Form Logic Routes
API endpoints for calculated fields and skip logic
"""

import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from logic_engine import CalculationEngine, SkipLogicEngine, process_form_logic

router = APIRouter(prefix="/logic", tags=["Form Logic"])


class EvaluateRequest(BaseModel):
    form_id: str
    values: Dict[str, Any]


class CalculateRequest(BaseModel):
    expression: str
    values: Dict[str, Any]


class SkipLogicCondition(BaseModel):
    field: str
    operator: str
    value: Any


class SkipLogicRule(BaseModel):
    type: str = "and"  # "and" or "or"
    conditions: List[SkipLogicCondition]


class ValidateSkipLogicRequest(BaseModel):
    logic: SkipLogicRule
    values: Dict[str, Any]


def get_db():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "datapulse")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


@router.post("/evaluate")
async def evaluate_form_logic(request: EvaluateRequest):
    """
    Evaluate all form logic (calculations and skip logic) for given values.
    Returns calculated field values and field visibility.
    """
    db = get_db()
    
    # Get form definition
    form = await db.forms.find_one({"id": request.form_id})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    result = process_form_logic(form, request.values)
    
    return result


@router.post("/calculate")
async def calculate_expression(request: CalculateRequest):
    """
    Evaluate a single calculation expression.
    Useful for testing calculations in the form builder.
    """
    engine = CalculationEngine()
    
    try:
        result = engine.evaluate(request.expression, request.values)
        return {
            "expression": request.expression,
            "result": result,
            "type": type(result).__name__ if result is not None else "null"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Calculation error: {str(e)}")


@router.post("/validate-skip-logic")
async def validate_skip_logic(request: ValidateSkipLogicRequest):
    """
    Test if skip logic condition evaluates to true/false.
    Useful for testing conditions in the skip logic editor.
    """
    engine = SkipLogicEngine()
    
    logic_dict = {
        "type": request.logic.type,
        "conditions": [c.dict() for c in request.logic.conditions]
    }
    
    result = engine.evaluate_logic(logic_dict, request.values)
    
    return {
        "is_visible": result,
        "logic": logic_dict,
        "values_used": request.values
    }


@router.get("/operators")
async def get_available_operators():
    """Get list of available skip logic operators"""
    return {
        "operators": [
            {"id": "==", "label": "Equals", "description": "Field value equals expected value"},
            {"id": "!=", "label": "Not Equals", "description": "Field value does not equal expected value"},
            {"id": ">", "label": "Greater Than", "description": "Field value is greater than (numeric)"},
            {"id": ">=", "label": "Greater or Equal", "description": "Field value is greater than or equal (numeric)"},
            {"id": "<", "label": "Less Than", "description": "Field value is less than (numeric)"},
            {"id": "<=", "label": "Less or Equal", "description": "Field value is less than or equal (numeric)"},
            {"id": "contains", "label": "Contains", "description": "Text contains substring"},
            {"id": "not_contains", "label": "Does Not Contain", "description": "Text does not contain substring"},
            {"id": "is_empty", "label": "Is Empty", "description": "Field has no value"},
            {"id": "is_not_empty", "label": "Is Not Empty", "description": "Field has a value"},
            {"id": "selected", "label": "Option Selected", "description": "Multi-select includes option"},
            {"id": "not_selected", "label": "Option Not Selected", "description": "Multi-select excludes option"}
        ]
    }


@router.get("/functions")
async def get_available_functions():
    """Get list of available calculation functions"""
    return {
        "functions": [
            {"name": "round", "syntax": "round(value, decimals)", "description": "Round to decimal places"},
            {"name": "abs", "syntax": "abs(value)", "description": "Absolute value"},
            {"name": "min", "syntax": "min(a, b, ...)", "description": "Minimum value"},
            {"name": "max", "syntax": "max(a, b, ...)", "description": "Maximum value"},
            {"name": "sum", "syntax": "sum([a, b, ...])", "description": "Sum of values"},
            {"name": "sqrt", "syntax": "sqrt(value)", "description": "Square root"},
            {"name": "pow", "syntax": "pow(base, exponent)", "description": "Power/exponent"},
            {"name": "floor", "syntax": "floor(value)", "description": "Round down"},
            {"name": "ceil", "syntax": "ceil(value)", "description": "Round up"},
            {"name": "today", "syntax": "today()", "description": "Current date (YYYY-MM-DD)"},
            {"name": "now", "syntax": "now()", "description": "Current datetime (ISO format)"},
            {"name": "age", "syntax": "age(date_of_birth)", "description": "Calculate age from DOB"},
            {"name": "year", "syntax": "year(date)", "description": "Extract year from date"},
            {"name": "month", "syntax": "month(date)", "description": "Extract month from date"},
            {"name": "day", "syntax": "day(date)", "description": "Extract day from date"},
            {"name": "iif", "syntax": "iif(condition, true_value, false_value)", "description": "Conditional (use gte, gt, lte, lt for comparisons)"},
            {"name": "gte", "syntax": "gte(a, b)", "description": "Greater than or equal (a >= b)"},
            {"name": "gt", "syntax": "gt(a, b)", "description": "Greater than (a > b)"},
            {"name": "lte", "syntax": "lte(a, b)", "description": "Less than or equal (a <= b)"},
            {"name": "lt", "syntax": "lt(a, b)", "description": "Less than (a < b)"},
            {"name": "eq", "syntax": "eq(a, b)", "description": "Equals (a == b)"},
            {"name": "ne", "syntax": "ne(a, b)", "description": "Not equals (a != b)"},
            {"name": "coalesce", "syntax": "coalesce(a, b, ...)", "description": "First non-null value"},
            {"name": "concat", "syntax": "concat(a, b, ...)", "description": "Join strings"},
            {"name": "upper", "syntax": "upper(text)", "description": "Convert to uppercase"},
            {"name": "lower", "syntax": "lower(text)", "description": "Convert to lowercase"},
            {"name": "contains", "syntax": "contains(text, substring)", "description": "Check if contains"},
            {"name": "selected", "syntax": "selected(field, option)", "description": "Check if option selected"},
            {"name": "count_selected", "syntax": "count_selected(field)", "description": "Count selected options"}
        ],
        "examples": [
            {"description": "Calculate BMI", "formula": "round(weight / ((height/100) * (height/100)), 1)"},
            {"description": "Total cost", "formula": "quantity * unit_price"},
            {"description": "Average score", "formula": "round((score1 + score2 + score3) / 3, 1)"},
            {"description": "Age from DOB", "formula": "age(date_of_birth)"},
            {"description": "Pass/Fail", "formula": "iif(gte(score, 50), 'Pass', 'Fail')"},
            {"description": "Count symptoms", "formula": "count_selected(symptoms)"}
        ]
    }
