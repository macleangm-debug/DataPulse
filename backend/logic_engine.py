"""DataPulse - Form Logic Engine
Handles calculated fields and skip logic evaluation
"""

import re
import math
from typing import Any, Dict, List, Optional
from datetime import datetime


class CalculationEngine:
    """
    Evaluates calculated field expressions safely.
    Supports basic math, comparisons, and common functions.
    """
    
    # Safe functions available in calculations
    SAFE_FUNCTIONS = {
        'abs': abs,
        'round': round,
        'min': min,
        'max': max,
        'sum': sum,
        'len': len,
        'int': int,
        'float': float,
        'str': str,
        'sqrt': math.sqrt,
        'pow': pow,
        'floor': math.floor,
        'ceil': math.ceil,
        'today': lambda: datetime.now().strftime('%Y-%m-%d'),
        'now': lambda: datetime.now().isoformat(),
        'year': lambda d: int(d[:4]) if isinstance(d, str) and len(d) >= 4 else None,
        'month': lambda d: int(d[5:7]) if isinstance(d, str) and len(d) >= 7 else None,
        'day': lambda d: int(d[8:10]) if isinstance(d, str) and len(d) >= 10 else None,
        'age': lambda dob: calculate_age(dob),
        'iif': lambda cond, true_val, false_val: true_val if cond else false_val,
        'coalesce': lambda *args: next((a for a in args if a is not None), None),
        'concat': lambda *args: ''.join(str(a) for a in args if a is not None),
        'upper': lambda s: s.upper() if isinstance(s, str) else s,
        'lower': lambda s: s.lower() if isinstance(s, str) else s,
        'contains': lambda s, sub: sub in s if isinstance(s, str) else False,
        'selected': lambda val, opt: opt in val if isinstance(val, list) else val == opt,
        'count_selected': lambda val: len(val) if isinstance(val, list) else (1 if val else 0),
        # Comparison functions for conditional expressions
        'gte': lambda a, b: a >= b,
        'gt': lambda a, b: a > b,
        'lte': lambda a, b: a <= b,
        'lt': lambda a, b: a < b,
        'eq': lambda a, b: a == b,
        'ne': lambda a, b: a != b,
        # Boolean values
        'True': True,
        'False': False,
    }
    
    def __init__(self):
        self.cache = {}
    
    def evaluate(self, expression: str, values: Dict[str, Any]) -> Any:
        """
        Evaluate a calculation expression with form values.
        
        Args:
            expression: The calculation formula (e.g., "weight / (height * height)")
            values: Dict of field_name -> value
            
        Returns:
            The calculated result
        """
        if not expression:
            return None
        
        try:
            # Replace field references with values
            eval_expr = expression
            
            # Sort by length (descending) to avoid partial replacements
            sorted_fields = sorted(values.keys(), key=len, reverse=True)
            
            for field_name in sorted_fields:
                value = values.get(field_name)
                
                # Convert value to safe string representation
                if value is None:
                    safe_value = "None"
                elif isinstance(value, str):
                    safe_value = f"'{value}'"
                elif isinstance(value, list):
                    safe_value = str(value)
                elif isinstance(value, bool):
                    safe_value = str(value)
                else:
                    safe_value = str(value)
                
                # Replace field name with value (word boundary)
                eval_expr = re.sub(r'\b' + re.escape(field_name) + r'\b', safe_value, eval_expr)
            
            # Evaluate with safe globals that include comparison operators
            safe_globals = {
                "__builtins__": {
                    "True": True,
                    "False": False,
                    "None": None,
                }
            }
            result = eval(eval_expr, safe_globals, self.SAFE_FUNCTIONS)
            
            return result
            
        except ZeroDivisionError:
            return None
        except Exception as e:
            print(f"Calculation error: {e} for expression: {expression}")
            return None


class SkipLogicEngine:
    """
    Evaluates skip logic conditions to determine field visibility.
    """
    
    # Supported operators
    OPERATORS = {
        '==': lambda a, b: a == b,
        '!=': lambda a, b: a != b,
        '>': lambda a, b: float(a) > float(b) if a and b else False,
        '>=': lambda a, b: float(a) >= float(b) if a and b else False,
        '<': lambda a, b: float(a) < float(b) if a and b else False,
        '<=': lambda a, b: float(a) <= float(b) if a and b else False,
        'contains': lambda a, b: b in a if isinstance(a, (str, list)) else False,
        'not_contains': lambda a, b: b not in a if isinstance(a, (str, list)) else True,
        'is_empty': lambda a, _: not a or a == [] or a == '',
        'is_not_empty': lambda a, _: bool(a) and a != [] and a != '',
        'selected': lambda a, b: b in a if isinstance(a, list) else a == b,
        'not_selected': lambda a, b: b not in a if isinstance(a, list) else a != b,
    }
    
    def evaluate_condition(self, condition: Dict, values: Dict[str, Any]) -> bool:
        """
        Evaluate a single skip logic condition.
        
        Args:
            condition: {
                "field": "field_name",
                "operator": "==",
                "value": "expected_value"
            }
            values: Current form values
            
        Returns:
            True if condition is met (field should be shown)
        """
        field = condition.get('field')
        operator = condition.get('operator', '==')
        expected = condition.get('value')
        
        if not field:
            return True
        
        actual = values.get(field)
        
        op_func = self.OPERATORS.get(operator)
        if not op_func:
            return True
        
        try:
            return op_func(actual, expected)
        except Exception:
            return True
    
    def evaluate_logic(self, logic: Dict, values: Dict[str, Any]) -> bool:
        """
        Evaluate complex skip logic with AND/OR conditions.
        
        Args:
            logic: {
                "type": "and" | "or",
                "conditions": [
                    {"field": "age", "operator": ">=", "value": 18},
                    {"field": "consent", "operator": "==", "value": "yes"}
                ]
            }
            values: Current form values
            
        Returns:
            True if field should be visible
        """
        if not logic:
            return True
        
        logic_type = logic.get('type', 'and').lower()
        conditions = logic.get('conditions', [])
        
        if not conditions:
            return True
        
        results = [self.evaluate_condition(c, values) for c in conditions]
        
        if logic_type == 'or':
            return any(results)
        else:  # 'and'
            return all(results)
    
    def get_visible_fields(self, fields: List[Dict], values: Dict[str, Any]) -> List[str]:
        """
        Get list of field IDs that should be visible based on skip logic.
        
        Args:
            fields: List of field definitions
            values: Current form values
            
        Returns:
            List of visible field IDs
        """
        visible = []
        
        for field in fields:
            field_id = field.get('id')
            skip_logic = field.get('skip_logic') or field.get('relevant')
            
            if skip_logic:
                if self.evaluate_logic(skip_logic, values):
                    visible.append(field_id)
            else:
                visible.append(field_id)
        
        return visible


def calculate_age(date_of_birth: str) -> Optional[int]:
    """Calculate age from date of birth string (YYYY-MM-DD)"""
    if not date_of_birth:
        return None
    
    try:
        dob = datetime.strptime(date_of_birth[:10], '%Y-%m-%d')
        today = datetime.now()
        age = today.year - dob.year
        
        # Adjust if birthday hasn't occurred yet this year
        if (today.month, today.day) < (dob.month, dob.day):
            age -= 1
        
        return age
    except Exception:
        return None


# API endpoint handler
def process_form_logic(form_definition: Dict, values: Dict[str, Any]) -> Dict:
    """
    Process all form logic (calculations and skip logic) for current values.
    
    Returns:
        {
            "calculated_values": {"bmi": 22.5, "total": 100},
            "visible_fields": ["field1", "field2", "field3"],
            "hidden_fields": ["field4"]
        }
    """
    calc_engine = CalculationEngine()
    skip_engine = SkipLogicEngine()
    
    fields = form_definition.get('fields', [])
    calculated_values = {}
    
    # First pass: evaluate calculated fields
    for field in fields:
        if field.get('type') == 'calculate':
            expression = field.get('calculation')
            if expression:
                result = calc_engine.evaluate(expression, {**values, **calculated_values})
                calculated_values[field.get('name', field.get('id'))] = result
    
    # Second pass: evaluate skip logic with calculated values included
    all_values = {**values, **calculated_values}
    visible_fields = skip_engine.get_visible_fields(fields, all_values)
    
    all_field_ids = [f.get('id') for f in fields]
    hidden_fields = [fid for fid in all_field_ids if fid not in visible_fields]
    
    return {
        "calculated_values": calculated_values,
        "visible_fields": visible_fields,
        "hidden_fields": hidden_fields
    }


# Example skip logic structures:
SKIP_LOGIC_EXAMPLES = {
    "simple": {
        "type": "and",
        "conditions": [
            {"field": "has_children", "operator": "==", "value": "yes"}
        ]
    },
    "age_check": {
        "type": "and",
        "conditions": [
            {"field": "age", "operator": ">=", "value": 18}
        ]
    },
    "complex": {
        "type": "or",
        "conditions": [
            {"field": "employment_status", "operator": "==", "value": "employed"},
            {"field": "employment_status", "operator": "==", "value": "self_employed"}
        ]
    },
    "multi_select": {
        "type": "and",
        "conditions": [
            {"field": "symptoms", "operator": "selected", "value": "fever"}
        ]
    }
}


# Example calculation expressions:
CALCULATION_EXAMPLES = [
    "weight / ((height/100) * (height/100))",  # BMI
    "quantity * unit_price",  # Total cost
    "round((score1 + score2 + score3) / 3, 1)",  # Average
    "age(date_of_birth)",  # Age from DOB
    "if(score >= 50, 'Pass', 'Fail')",  # Conditional
    "count_selected(symptoms)",  # Count selections
]
