"""أنواع البيانات التي يعيدها محرّك الإعراب."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(slots=True)
class TokenAnalysis:
    """تحليل كلمة واحدة بصيغة مناسبة للواجهة وواجهة API."""

    index: int
    word: str
    normalized: str
    kind: str = "اسم"
    role: str = "غير محدد"
    state: str = ""
    sign: str = ""
    explanation: str = ""
    confidence: float = 0.50
    features: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["confidence"] = round(self.confidence, 2)
        return data


@dataclass(slots=True)
class ParseResult:
    """النتيجة الكاملة لتحليل جملة."""

    text: str
    requested_level: str
    detected_level: str
    model: str
    sentence_type: str
    summary: str
    confidence: float
    elapsed_ms: float
    tokens: list[TokenAnalysis]
    notes: list[str] = field(default_factory=list)
    version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "requestedLevel": self.requested_level,
            "detectedLevel": self.detected_level,
            "model": self.model,
            "sentenceType": self.sentence_type,
            "summary": self.summary,
            "confidence": round(self.confidence, 2),
            "elapsedMs": round(self.elapsed_ms, 2),
            "tokens": [token.to_dict() for token in self.tokens],
            "notes": self.notes,
            "version": self.version,
        }
