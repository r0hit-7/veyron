from typing import List, Literal, Optional

from google import genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import firebase_store, settings
from routes.utils import CRISIS_RESPONSE_EN, CRISIS_RESPONSE_HI, detect_emotion, iso_now, sha_key

router = APIRouter(tags=["chatbot"])

SYSTEM_PROMPT = (
    "You are CyberSaathi, India's cyber safety AI companion.\n"
    "You MUST reply fully in the user's selected language (English or हिंदी). Do not mix languages.\n"
    "ALWAYS detect emotional state. If panic is detected (scared, confused, lost), CALM FIRST before advice.\n"
    "Use empathy and validation. Victims are not foolish—scams are professional traps.\n"
    "Give step-by-step, actionable guidance. Keep responses under 200 words.\n"
    "If the user needs reporting/legal steps, mention Complaint Hub and cybercrime.gov.in.\n"
)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: Optional[List[ChatTurn]] = Field(default_factory=list)
    language: Literal["English", "हिंदी", "Hinglish"] = "English"


class ChatResponse(BaseModel):
    response: str
    emotion: Literal["calm", "panic", "crisis", "normal"]
    suggestedAction: str
    englishSummary: str
    hindiSummary: str
    quickActions: List[dict] = Field(default_factory=list)


def _suggested_action(emotion: str) -> str:
    mapping = {
        "crisis": "Call mental health helpline now and stay with trusted person.",
        "panic": "Take 3 deep breaths, stop payments immediately, preserve evidence.",
        "calm": "Follow step-by-step reporting and security cleanup.",
        "normal": "Run safety checks and enable account protections.",
    }
    return mapping.get(emotion, mapping["normal"])


def _gemini_reply(message: str, history: List[ChatTurn], language: str) -> str:
    if not settings.gemini_api_key:
        # Safe fallback: keep CyberSaathi usable even without external LLM config.
        return (
            "I can help. For immediate safety: stop payments, call 1930 if it’s financial fraud, "
            "save screenshots/evidence, and file a report on cybercrime.gov.in. Tell me what happened (UPI/OTP/app/link) and I’ll guide you."
            if language == "English"
            else "मैं मदद कर सकता/सकती हूँ। तुरंत सुरक्षा के लिए: भुगतान रोकें, यदि वित्तीय धोखाधड़ी है तो 1930 पर कॉल करें, "
            "सबूत (स्क्रीनशॉट/चैट/ट्रांजैक्शन) सुरक्षित रखें, और cybercrime.gov.in पर रिपोर्ट दर्ज करें। बताइए क्या हुआ (UPI/OTP/ऐप/लिंक) ताकि मैं कदम-दर-कदम मार्गदर्शन कर सकूँ।"
        )
    client = genai.Client(api_key=settings.gemini_api_key)
    turns = "\n".join([f"{h.role}: {h.content}" for h in history[-16:]])
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Reply language preference: {language}\n"
        "Always include actionable next steps in bullets when user reports a scam.\n"
        "If user needs complaint or legal reporting, mention Complaint Hub and cybercrime.gov.in.\n\n"
        f"Conversation:\n{turns}\nuser: {message}\nassistant:"
    )
    result = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    text = getattr(result, "text", None)
    if not text:
        return (
            "I’m here to help. Please share a bit more detail so I can guide you step by step."
            if language == "English"
            else "मैं आपकी मदद के लिए यहाँ हूँ। कृपया थोड़ा और विवरण साझा करें ताकि मैं आपको कदम-दर-कदम मार्गदर्शन दे सकूँ।"
        )
    return text.strip()


def _quick_actions(message: str, emotion: str) -> List[dict]:
    lowered = message.lower()
    actions: List[dict] = []
    if any(x in lowered for x in ["scam", "fraud", "upi", "money", "bank", "otp", "phishing"]):
        actions.append({"type": "navigate", "target": "complaints", "label": "Open Complaint Hub"})
        actions.append({"type": "link", "target": "https://cybercrime.gov.in", "label": "Report on cybercrime.gov.in"})
    if emotion in {"panic", "crisis"}:
        actions.append({"type": "call", "target": "1930", "label": "Call Cyber Helpline 1930"})
    return actions[:3]


@router.post("/chat", response_model=ChatResponse)
def chat_with_cybersaathi(payload: ChatRequest) -> ChatResponse:
    emotion = detect_emotion(payload.message)
    language = payload.language
    # Backward compatibility: treat "Hinglish" as Hindi, but respond in proper Hindi.
    if language == "Hinglish":
        language = "हिंदी"

    if emotion == "crisis":
        response_text = CRISIS_RESPONSE_EN if language == "English" else CRISIS_RESPONSE_HI
    else:
        response_text = _gemini_reply(payload.message, payload.history or [], language)

    chat_id = sha_key(payload.message + iso_now())
    if firebase_store.enabled:
        firebase_store.save_document(
            "chat_history",
            chat_id,
            {
                "message": payload.message,
                "history": [x.model_dump() for x in payload.history or []],
                "language": payload.language,
                "response": response_text,
                "emotion": emotion,
                "createdAt": iso_now(),
            },
        )
    suggested = _suggested_action(emotion)
    quick_actions = _quick_actions(payload.message, emotion)
    return ChatResponse(
        response=response_text,
        emotion=emotion,
        suggestedAction=suggested,
        englishSummary="Follow safe steps and avoid making decisions in panic.",
        hindiSummary="सुरक्षित कदम अपनाएँ और घबराहट में कोई निर्णय न लें।",
        quickActions=quick_actions,
    )
