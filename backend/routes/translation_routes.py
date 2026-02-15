"""DataPulse - Multi-Language Translation Service"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import json

from auth import get_current_user

router = APIRouter(prefix="/translations", tags=["Translations"])


# Supported languages
SUPPORTED_LANGUAGES = [
    {"code": "en", "name": "English", "native": "English", "rtl": False},
    {"code": "sw", "name": "Swahili", "native": "Kiswahili", "rtl": False},
    {"code": "fr", "name": "French", "native": "Français", "rtl": False},
    {"code": "es", "name": "Spanish", "native": "Español", "rtl": False},
    {"code": "pt", "name": "Portuguese", "native": "Português", "rtl": False},
    {"code": "ar", "name": "Arabic", "native": "العربية", "rtl": True},
    {"code": "hi", "name": "Hindi", "native": "हिन्दी", "rtl": False},
    {"code": "zh", "name": "Chinese", "native": "中文", "rtl": False},
    {"code": "am", "name": "Amharic", "native": "አማርኛ", "rtl": False},
    {"code": "yo", "name": "Yoruba", "native": "Yorùbá", "rtl": False},
    {"code": "ha", "name": "Hausa", "native": "Hausa", "rtl": False},
    {"code": "ig", "name": "Igbo", "native": "Igbo", "rtl": False},
    {"code": "zu", "name": "Zulu", "native": "isiZulu", "rtl": False},
    {"code": "xh", "name": "Xhosa", "native": "isiXhosa", "rtl": False}
]


class TranslationRequest(BaseModel):
    text: str
    source_language: str = "en"
    target_language: str


class BulkTranslationRequest(BaseModel):
    texts: List[str]
    source_language: str = "en"
    target_language: str


class FormTranslationRequest(BaseModel):
    form_id: str
    source_language: str = "en"
    target_languages: List[str]
    fields_to_translate: Optional[List[str]] = None  # If None, translate all


# Simple translation cache/dictionary for common phrases
TRANSLATION_CACHE = {
    "sw": {
        "Yes": "Ndiyo",
        "No": "Hapana",
        "Name": "Jina",
        "Age": "Umri",
        "Gender": "Jinsia",
        "Male": "Mwanaume",
        "Female": "Mwanamke",
        "Date": "Tarehe",
        "Location": "Mahali",
        "Phone": "Simu",
        "Email": "Barua pepe",
        "Address": "Anwani",
        "Submit": "Wasilisha",
        "Cancel": "Ghairi",
        "Next": "Inayofuata",
        "Previous": "Iliyotangulia",
        "Save": "Hifadhi",
        "Delete": "Futa",
        "Edit": "Hariri",
        "Required": "Inahitajika",
        "Optional": "Si lazima"
    },
    "fr": {
        "Yes": "Oui",
        "No": "Non",
        "Name": "Nom",
        "Age": "Âge",
        "Gender": "Genre",
        "Male": "Masculin",
        "Female": "Féminin",
        "Date": "Date",
        "Location": "Emplacement",
        "Phone": "Téléphone",
        "Email": "E-mail",
        "Address": "Adresse",
        "Submit": "Soumettre",
        "Cancel": "Annuler",
        "Next": "Suivant",
        "Previous": "Précédent",
        "Save": "Enregistrer",
        "Delete": "Supprimer",
        "Edit": "Modifier",
        "Required": "Obligatoire",
        "Optional": "Optionnel"
    },
    "es": {
        "Yes": "Sí",
        "No": "No",
        "Name": "Nombre",
        "Age": "Edad",
        "Gender": "Género",
        "Male": "Masculino",
        "Female": "Femenino",
        "Date": "Fecha",
        "Location": "Ubicación",
        "Phone": "Teléfono",
        "Email": "Correo electrónico",
        "Address": "Dirección",
        "Submit": "Enviar",
        "Cancel": "Cancelar",
        "Next": "Siguiente",
        "Previous": "Anterior",
        "Save": "Guardar",
        "Delete": "Eliminar",
        "Edit": "Editar",
        "Required": "Obligatorio",
        "Optional": "Opcional"
    },
    "ar": {
        "Yes": "نعم",
        "No": "لا",
        "Name": "الاسم",
        "Age": "العمر",
        "Gender": "الجنس",
        "Male": "ذكر",
        "Female": "أنثى",
        "Date": "التاريخ",
        "Location": "الموقع",
        "Phone": "الهاتف",
        "Email": "البريد الإلكتروني",
        "Address": "العنوان",
        "Submit": "إرسال",
        "Cancel": "إلغاء",
        "Next": "التالي",
        "Previous": "السابق",
        "Save": "حفظ",
        "Delete": "حذف",
        "Edit": "تحرير",
        "Required": "مطلوب",
        "Optional": "اختياري"
    }
}


def simple_translate(text: str, target_lang: str) -> str:
    """Simple translation using cache or returning original"""
    if target_lang in TRANSLATION_CACHE:
        return TRANSLATION_CACHE[target_lang].get(text, text)
    return text


@router.get("/languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return {"languages": SUPPORTED_LANGUAGES}


@router.post("/translate")
async def translate_text(
    request: Request,
    translation_request: TranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Translate a single text string"""
    
    # Check if AI translation is needed (for demo, use cache)
    translated = simple_translate(
        translation_request.text,
        translation_request.target_language
    )
    
    # If not in cache, mark as needing AI translation
    needs_ai = translated == translation_request.text and translation_request.text not in ["", None]
    
    return {
        "original": translation_request.text,
        "translated": translated,
        "source_language": translation_request.source_language,
        "target_language": translation_request.target_language,
        "confidence": 1.0 if not needs_ai else 0.0,
        "needs_ai_translation": needs_ai
    }


@router.post("/translate/bulk")
async def translate_bulk(
    request: Request,
    bulk_request: BulkTranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Translate multiple text strings"""
    
    results = []
    for text in bulk_request.texts:
        translated = simple_translate(text, bulk_request.target_language)
        results.append({
            "original": text,
            "translated": translated
        })
    
    return {
        "translations": results,
        "source_language": bulk_request.source_language,
        "target_language": bulk_request.target_language,
        "count": len(results)
    }


@router.post("/forms/{form_id}/translate")
async def translate_form(
    request: Request,
    form_id: str,
    translation_request: FormTranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Translate all form fields to target languages"""
    db = request.app.state.db
    
    # Get form
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Translate fields
    fields = form.get("fields", [])
    translation_results = {}
    
    for target_lang in translation_request.target_languages:
        translation_results[target_lang] = []
        
        for field in fields:
            # Skip if specific fields requested and this isn't one
            if translation_request.fields_to_translate:
                if field.get("id") not in translation_request.fields_to_translate:
                    continue
            
            field_translations = {
                "field_id": field.get("id"),
                "field_name": field.get("name"),
                "translations": {}
            }
            
            # Translate label
            if field.get("label"):
                field_translations["translations"]["label"] = simple_translate(
                    field["label"], target_lang
                )
            
            # Translate hint
            if field.get("hint"):
                field_translations["translations"]["hint"] = simple_translate(
                    field["hint"], target_lang
                )
            
            # Translate options
            if field.get("options"):
                field_translations["translations"]["options"] = []
                for opt in field["options"]:
                    translated_opt = {
                        "value": opt.get("value"),
                        "label": simple_translate(opt.get("label", ""), target_lang)
                    }
                    field_translations["translations"]["options"].append(translated_opt)
            
            translation_results[target_lang].append(field_translations)
    
    return {
        "form_id": form_id,
        "source_language": translation_request.source_language,
        "translations": translation_results
    }


@router.post("/forms/{form_id}/apply-translations")
async def apply_form_translations(
    request: Request,
    form_id: str,
    translations: Dict[str, List[Dict]],
    current_user: dict = Depends(get_current_user)
):
    """Apply translations to form fields"""
    db = request.app.state.db
    
    # Get form
    form = await db.forms.find_one({"id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    fields = form.get("fields", [])
    languages = form.get("languages", ["en"])
    
    # Apply translations to each field
    for lang_code, field_translations in translations.items():
        if lang_code not in languages:
            languages.append(lang_code)
        
        for trans in field_translations:
            field_id = trans.get("field_id")
            trans_data = trans.get("translations", {})
            
            # Find and update field
            for field in fields:
                if field.get("id") == field_id:
                    # Add translated label
                    if "label" in trans_data:
                        field[f"label_{lang_code}"] = trans_data["label"]
                    
                    # Add translated hint
                    if "hint" in trans_data:
                        field[f"hint_{lang_code}"] = trans_data["hint"]
                    
                    # Add translated options
                    if "options" in trans_data and field.get("options"):
                        for i, opt_trans in enumerate(trans_data["options"]):
                            if i < len(field["options"]):
                                field["options"][i][f"label_{lang_code}"] = opt_trans.get("label")
                    
                    break
    
    # Update form
    await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "fields": fields,
            "languages": languages,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Translations applied successfully",
        "languages": languages
    }


@router.get("/forms/{form_id}/languages")
async def get_form_languages(
    request: Request,
    form_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get languages configured for a form"""
    db = request.app.state.db
    
    form = await db.forms.find_one({"id": form_id}, {"_id": 0, "languages": 1, "default_language": 1})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    languages = form.get("languages", ["en"])
    default = form.get("default_language", "en")
    
    # Get language details
    language_details = []
    for lang_code in languages:
        lang_info = next((l for l in SUPPORTED_LANGUAGES if l["code"] == lang_code), None)
        if lang_info:
            language_details.append({
                **lang_info,
                "is_default": lang_code == default
            })
    
    return {
        "form_id": form_id,
        "default_language": default,
        "languages": language_details
    }


@router.put("/forms/{form_id}/default-language")
async def set_default_language(
    request: Request,
    form_id: str,
    language_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Set the default language for a form"""
    db = request.app.state.db
    
    # Validate language code
    if not any(l["code"] == language_code for l in SUPPORTED_LANGUAGES):
        raise HTTPException(status_code=400, detail="Unsupported language")
    
    result = await db.forms.update_one(
        {"id": form_id},
        {"$set": {
            "default_language": language_code,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Form not found")
    
    return {"message": f"Default language set to {language_code}"}


@router.get("/glossary/{org_id}")
async def get_translation_glossary(
    request: Request,
    org_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get organization's translation glossary"""
    db = request.app.state.db
    
    glossary = await db.glossary.find(
        {"org_id": org_id},
        {"_id": 0}
    ).to_list(500)
    
    return {"glossary": glossary}


@router.post("/glossary/{org_id}")
async def add_glossary_term(
    request: Request,
    org_id: str,
    term: str,
    translations: Dict[str, str],
    current_user: dict = Depends(get_current_user)
):
    """Add a term to the organization's glossary"""
    db = request.app.state.db
    
    glossary_entry = {
        "id": str(ObjectId()),
        "org_id": org_id,
        "term": term,
        "translations": translations,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.glossary.insert_one(glossary_entry)
    
    return {"id": glossary_entry["id"], "message": "Glossary term added"}
