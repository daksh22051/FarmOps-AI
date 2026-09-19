"""
FarmOps AI - Computer Vision Service for Farm Photo Inspection & Agronomic Analysis
Uses Google Gemini Multimodal Vision API to validate agricultural authenticity
and extract initial crop, soil, and vegetation health telemetry.
"""

import json
import base64
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.config import settings
from app.core.logging import logger


class FarmVisionInspectionResult(BaseModel):
    is_valid_farm: bool
    category: str
    confidence: float
    rejection_reason: Optional[str] = None
    detected_crop: Optional[str] = None
    vegetation_health: Optional[str] = None
    soil_condition: Optional[str] = None
    canopy_cover_pct: Optional[float] = None
    agronomic_advice: Optional[str] = None


class VisionService:
    @staticmethod
    async def inspect_farm_photo(image_base64: str, mime_type: str = "image/jpeg") -> FarmVisionInspectionResult:
        """
        Inspects an uploaded image using Gemini Multimodal Vision.
        Determines whether the image is a genuine farm, field, crop, or soil photo.
        Rejects non-farm images (code screenshots, software interfaces, selfies, memes, etc.).
        """
        # Strip data URL prefix if present
        clean_base64 = image_base64
        if "base64," in clean_base64:
            parts = clean_base64.split("base64,")
            clean_base64 = parts[1]
            if "image/" in parts[0]:
                mime_type = parts[0].split(";")[0].replace("data:", "")

        prompt = """You are the FarmOps AI Agricultural Computer Vision Inspector.
Your job is to strictly inspect images uploaded by farmers during farm onboarding.

CRITICAL TASK:
1. Determine if this image is a genuine farm, agricultural field, crop plantation, plant, soil, or farming landscape.
2. If it is NOT a farm (e.g. computer code, IDE screenshot, software UI, document, vehicle, animal pet, selfie, indoor room, text, or meme), you MUST set is_valid_farm = false and provide a clear, helpful rejection_reason in simple farmer-friendly language explaining why it was rejected.
3. If it IS a farm/agricultural image, set is_valid_farm = true, identify the crop/vegetation, assess visual vegetation health, soil condition, canopy cover %, and provide agronomic advice.

Respond ONLY with a valid JSON object matching this schema:
{
  "is_valid_farm": boolean,
  "category": string,
  "confidence": number,
  "rejection_reason": string or null,
  "detected_crop": string or null,
  "vegetation_health": string or null,
  "soil_condition": string or null,
  "canopy_cover_pct": number or null,
  "agronomic_advice": string or null
}
"""

        # Call Gemini REST API with gemini-3.1-flash-lite-preview or gemini-flash-latest
        models_to_try = ["gemini-3.1-flash-lite-preview", "gemini-flash-latest", "gemini-2.5-flash"]
        for model_name in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt},
                                {
                                    "inlineData": {
                                        "mimeType": mime_type,
                                        "data": clean_base64
                                    }
                                }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }

                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={"Content-Type": "application/json"}
                )

                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    data = json.loads(text)

                    return FarmVisionInspectionResult(
                        is_valid_farm=bool(data.get("is_valid_farm", False)),
                        category=data.get("category", "Unknown"),
                        confidence=float(data.get("confidence", 0.9)),
                        rejection_reason=data.get("rejection_reason"),
                        detected_crop=data.get("detected_crop"),
                        vegetation_health=data.get("vegetation_health"),
                        soil_condition=data.get("soil_condition"),
                        canopy_cover_pct=float(data["canopy_cover_pct"]) if data.get("canopy_cover_pct") is not None else None,
                        agronomic_advice=data.get("agronomic_advice"),
                    )

            except urllib.error.HTTPError as http_err:
                logger.warning(f"Gemini vision call failed on model {model_name}: {http_err.code}")
                continue
            except Exception as err:
                logger.warning(f"Gemini vision error on {model_name}: {err}")
                continue

        # Fallback heuristic if API quota or connection issue
        logger.warning("All Gemini vision models unavailable, applying local heuristic validation.")
        return VisionService._fallback_heuristic(clean_base64)

    @staticmethod
    def _fallback_heuristic(clean_base64: str) -> FarmVisionInspectionResult:
        """
        Fallback heuristic if Gemini is unreachable.
        Analyzes rough base64 byte characteristics.
        Rejects unverified or invalid files safely.
        """
        try:
            raw_bytes = base64.b64decode(clean_base64[:10000])
            is_png = raw_bytes.startswith(b"\x89PNG")
            is_jpg = raw_bytes.startswith(b"\xff\xd8")
            
            if not (is_png or is_jpg):
                return FarmVisionInspectionResult(
                    is_valid_farm=False,
                    category="Unsupported File",
                    confidence=0.9,
                    rejection_reason="The file format is not a recognized image. Please upload a PNG or JPEG photo.",
                )
        except Exception:
            pass

        # If Gemini is unavailable, do NOT blindly accept random images (like code screenshots).
        # Require a valid agricultural photo.
        return FarmVisionInspectionResult(
            is_valid_farm=False,
            category="Unverified Image",
            confidence=0.5,
            rejection_reason="FarmOps AI Vision could not verify the agricultural authenticity of this image. Please upload a clear photo of your farm field, crops, or soil.",
        )
