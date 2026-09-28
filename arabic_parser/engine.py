"""محرّك «مِعْراب» القاعدي المصغّر.

صُمم المحرّك ليكون حتميًا، سريعًا، وقابلًا للعمل بلا شبكة. وهو يجمع بين
معجم صغير وتحليل صرفي خفيف وقواعد سياقية متدرجة بدل نموذج لغوي ضخم.
"""

from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from statistics import fmean

from . import lexicon as lx
from .text import has_definite_article, is_punctuation, normalize_word, strip_diacritics, tokenize, without_common_prefix
from .types import ParseResult, TokenAnalysis

LEVEL_RANK = {"easy": 1, "medium": 2, "hard": 3}
LEVEL_AR = {"easy": "سهل", "medium": "متوسط", "hard": "متقدم"}


@dataclass(frozen=True, slots=True)
class ModelProfile:
    id: str
    name_ar: str
    level: str
    description_ar: str
    rules: tuple[str, ...]


def _resource_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent.parent


def _load_profiles() -> dict[str, ModelProfile]:
    profiles: dict[str, ModelProfile] = {}
    for level in ("easy", "medium", "hard"):
        path = _resource_root() / "models" / f"{level}.json"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            profiles[level] = ModelProfile(
                id=data["id"],
                name_ar=data["name_ar"],
                level=level,
                description_ar=data["description_ar"],
                rules=tuple(data["rules"]),
            )
        except (OSError, KeyError, json.JSONDecodeError):
            # قيم احتياطية تجعل الملف التنفيذي قادرًا على البدء حتى إن أسيء حزمه.
            names = {"easy": "نموذج الأساس", "medium": "نموذج التراكيب", "hard": "نموذج التراكيب المتقدمة"}
            profiles[level] = ModelProfile(f"nahw-mini-{level}-v1", names[level], level, "نموذج إعراب محلي", ())
    return profiles


PROFILES = _load_profiles()


def _bare(word: str) -> str:
    return strip_diacritics(word).replace("ـ", "")


def _stem_for_lookup(word: str) -> str:
    """يزيل أل وبعض حروف الربط والجر للحصول على مفتاح معجمي تقريبي."""
    _, key = without_common_prefix(word)
    if key.startswith("ال") and len(key) > 3:
        key = key[2:]
    return key


def _looks_present(key: str) -> bool:
    if key in lx.PRESENT_VERBS:
        return True
    if key.startswith("ال") or len(key) < 4 or key in lx.NOUN_HINTS or key in lx.ADJECTIVES or key in lx.DEMONSTRATIVES:
        return False
    # صيغ الأفعال الخمسة وبعض الأوزان كثيرة الدوران.
    if key[0] in "ايتن" and key.endswith(("ون", "ان", "ين")) and len(key) >= 5:
        return True
    patterns = ("يست", "تست", "نست", "است")
    return key.startswith(patterns) and len(key) >= 5


def _past_root(key: str) -> str | None:
    if key in lx.PAST_VERBS:
        return key
    for suffix in ("تما", "تم", "تن", "نا", "وا", "تا", "ت"):
        if key.endswith(suffix) and len(key) - len(suffix) >= 3:
            root = key[: -len(suffix)]
            if root in lx.PAST_VERBS:
                return root
    return None


def _is_nominal(token: TokenAnalysis) -> bool:
    return token.kind in {"اسم", "صفة", "ضمير", "اسم إشارة", "اسم موصول", "ظرف"}


def _is_definite(word: str, kind: str = "") -> bool:
    key = normalize_word(word)
    return has_definite_article(word) or kind in {"ضمير", "اسم إشارة", "اسم موصول"} or key in lx.PRONOUNS


def _case_sign(word: str, state: str) -> str:
    """يختار علامة إعراب أصلية أو فرعية من شكل الكلمة."""
    key = normalize_word(word)
    _, stem = without_common_prefix(word)
    if stem.startswith("ال"):
        stem = stem[2:]

    five_base = stem.rstrip("اوي")
    is_five_noun = stem in lx.FIVE_NOUNS or five_base in {"اب", "اخ", "حم", "ف", "ذ"}
    if is_five_noun and len(stem) >= 2:
        return {
            "مرفوع": "الواو نيابةً عن الضمة؛ لأنه من الأسماء الخمسة",
            "منصوب": "الألف نيابةً عن الفتحة؛ لأنه من الأسماء الخمسة",
            "مجرور": "الياء نيابةً عن الكسرة؛ لأنه من الأسماء الخمسة",
        }.get(state, "")

    if key.endswith("ان") and len(key) > 3:
        if state == "مرفوع":
            return "الألف نيابةً عن الضمة؛ لأنه مثنى"
        if state in {"منصوب", "مجرور"}:
            return "الياء نيابةً عن الفتحة أو الكسرة؛ لأنه مثنى"
    if key.endswith("ون") and len(key) > 3:
        if state == "مرفوع":
            return "الواو نيابةً عن الضمة؛ لأنه جمع مذكر سالم"
        return "الياء نيابةً عن الفتحة أو الكسرة؛ لأنه جمع مذكر سالم"
    if key.endswith("ين") and len(key) > 3:
        if state == "مرفوع":
            return "الواو المقدرة بحسب الصيغة، والأغلب أن الصواب ضبط الجمع بالواو"
        return "الياء نيابةً عن الفتحة أو الكسرة؛ لأنه مثنى أو جمع مذكر سالم"
    if key.endswith("ات") and len(key) > 3:
        if state == "منصوب":
            return "الكسرة نيابةً عن الفتحة؛ لأنه جمع مؤنث سالم"
        if state == "مرفوع":
            return "الضمة الظاهرة على آخره"
        if state == "مجرور":
            return "الكسرة الظاهرة على آخره"
    if stem in lx.DIPTOTES and state == "مجرور" and not has_definite_article(word):
        return "الفتحة نيابةً عن الكسرة؛ لأنه ممنوع من الصرف"
    # الألف المقصورة «ى» قرينة صريحة؛ أما «ا» فقد تكون ألف تنوين النصب (جميلًا).
    if _bare(word).endswith("ى"):
        signs = {"مرفوع": "الضمة المقدرة على الألف للتعذر", "منصوب": "الفتحة المقدرة على الألف للتعذر", "مجرور": "الكسرة المقدرة على الألف للتعذر"}
        return signs.get(state, "")
    return {
        "مرفوع": "الضمة الظاهرة على آخره",
        "منصوب": "الفتحة الظاهرة على آخره",
        "مجرور": "الكسرة الظاهرة على آخره",
        "مجزوم": "السكون الظاهر على آخره",
    }.get(state, "")


def _verb_sign(word: str, state: str) -> str:
    key = normalize_word(word)
    if key.endswith(("ون", "ان", "ين")):
        if state == "مرفوع":
            return "ثبوت النون؛ لأنه من الأفعال الخمسة"
        return "حذف النون؛ لأنه من الأفعال الخمسة"
    if state == "مجزوم" and _bare(word).endswith(("ا", "ى", "و", "ي")):
        return "حذف حرف العلة من آخره"
    if state in {"مرفوع", "منصوب"} and _bare(word).endswith("ى"):
        return f"{'الضمة' if state == 'مرفوع' else 'الفتحة'} المقدرة على الألف للتعذر"
    return {
        "مرفوع": "الضمة الظاهرة على آخره",
        "منصوب": "الفتحة الظاهرة على آخره",
        "مجزوم": "السكون الظاهر على آخره",
    }.get(state, "")


class ArabicGrammarEngine:
    """واجهة النماذج الثلاثة. الكائن آمن لإعادة الاستخدام بين الطلبات."""

    version = "1.0.0"

    def model_info(self) -> list[dict[str, object]]:
        return [
            {
                "id": p.id,
                "name": p.name_ar,
                "level": p.level,
                "description": p.description_ar,
                "rules": list(p.rules),
            }
            for p in PROFILES.values()
        ]

    def detect_level(self, words: list[str]) -> str:
        content = [w for w in words if not is_punctuation(w)]
        keys = [normalize_word(w) for w in content]
        bare = [_bare(w) for w in content]
        score = 0
        if len(content) >= 6:
            score += 1
        if len(content) >= 10:
            score += 2
        if any(w in {"إن", "أن", "كأن", "لكن", "ليت", "لعل"} for w in bare):
            score += 2
        if any(k in lx.KANA_SISTERS for k in keys):
            score += 2
        if any(k in lx.SUBJUNCTIVE_PARTICLES | lx.JUSSIVE_PARTICLES for k in keys):
            score += 2
        if any(k in lx.CONDITIONAL_PARTICLES for k in keys) and sum(_looks_present(k) for k in keys) >= 2:
            score += 3
        if any(k in lx.EXCEPTION_PARTICLES | lx.VOCATIVE_PARTICLES for k in keys):
            # الاستثناء والنداء من القواعد التي يتولاها النموذج المتقدم.
            score += 5
        if any(k in lx.RELATIVES for k in keys) or keys.count("الذي") + keys.count("التي"):
            score += 2
        if sum(1 for k in keys if _looks_present(k) or _past_root(k)) >= 2:
            score += 1
        if score <= 1:
            return "easy"
        if score <= 4:
            return "medium"
        return "hard"

    def parse(self, text: str, level: str = "auto") -> ParseResult:
        started = time.perf_counter()
        text = text.strip()
        if not text:
            raise ValueError("اكتب جملة عربية أولًا.")
        if len(text) > 1000:
            raise ValueError("النص طويل جدًا. الحد الأقصى 1000 حرف في كل عملية تحليل.")
        words = tokenize(text)
        if not words:
            raise ValueError("لم أجد كلمات قابلة للتحليل.")
        if len(words) > 120:
            raise ValueError("النص طويل جدًا. حلّل جملة أو جملتين في كل مرة.")
        requested = level if level in LEVEL_RANK else "auto"
        detected = self.detect_level(words)
        chosen = detected if requested == "auto" else requested
        profile = PROFILES[chosen]

        tokens = [self._classify(i, word) for i, word in enumerate(words)]
        content = [i for i, token in enumerate(tokens) if token.kind != "علامة ترقيم"]
        notes: list[str] = []
        if not content:
            raise ValueError("أدخل جملة تحتوي على كلمات، لا علامات ترقيم فقط.")

        self._resolve_ambiguous_particles(tokens, content, chosen)
        sentence_type = self._sentence_type(tokens, content)
        self._apply_particle_government(tokens, content, chosen)

        if sentence_type == "أسلوب شرط":
            self._parse_conditional(tokens, content)
        elif sentence_type.startswith("جملة اسمية منسوخة بإن"):
            self._parse_inna(tokens, content)
        elif sentence_type.startswith("جملة اسمية منسوخة بكان"):
            self._parse_kana(tokens, content)
        elif sentence_type.startswith("أسلوب نداء"):
            self._parse_vocative(tokens, content)
            self._parse_remaining_clause(tokens, content)
        elif "فعلية" in sentence_type:
            self._parse_verbal(tokens, content)
        else:
            self._parse_nominal(tokens, content)

        self._parse_prepositional_phrases(tokens, content)
        if LEVEL_RANK[chosen] >= 2:
            self._parse_idafa(tokens, content)
            self._parse_adjectives(tokens, content)
            self._parse_conjunctions(tokens, content)
        if LEVEL_RANK[chosen] >= 3:
            self._parse_exception(tokens, content)
            self._parse_relatives(tokens, content)

        self._finish_unassigned(tokens)
        if requested != "auto" and LEVEL_RANK[requested] < LEVEL_RANK[detected]:
            notes.append(f"تبدو الجملة {LEVEL_AR[detected]}. للحصول على قواعد أوسع اختر «تلقائي» أو نموذجًا أعلى.")
        notes.extend(self._ambiguity_notes(tokens))
        confidence = fmean(t.confidence for t in tokens if t.kind != "علامة ترقيم")
        summary = self._summary(sentence_type, tokens)
        elapsed = (time.perf_counter() - started) * 1000
        return ParseResult(
            text=text,
            requested_level=requested,
            detected_level=detected,
            model=profile.name_ar,
            sentence_type=sentence_type,
            summary=summary,
            confidence=confidence,
            elapsed_ms=elapsed,
            tokens=tokens,
            notes=notes,
            version=self.version,
        )

    def _classify(self, index: int, word: str) -> TokenAnalysis:
        key = normalize_word(word)
        bare = _bare(word)
        token = TokenAnalysis(index=index, word=word, normalized=key)
        if is_punctuation(word):
            token.kind = "علامة ترقيم"
            token.role = "فاصل كتابي"
            token.explanation = "علامة ترقيم لا محل لها من الإعراب."
            token.confidence = 1.0
            return token

        # الهمزة مهمة في التفريق بين «إن/أن» و«كأن» و«كان».
        if bare in {"إن", "أن", "كأن", "لكن", "ليت", "لعل"}:
            token.kind = "حرف ناسخ"
            token.role = "ناسخ"
            token.explanation = "حرف ناسخ يدخل على الجملة الاسمية؛ ينصب الاسم ويرفع الخبر."
            token.confidence = 0.95
        elif key in lx.KANA_SISTERS:
            token.kind = "فعل ناقص"
            token.role = "ناسخ"
            token.explanation = lx.KANA_SISTERS[key] + "؛ يرفع الاسم وينصب الخبر."
            token.confidence = 0.95
        elif key in lx.PREPOSITIONS:
            token.kind = "حرف جر"
            token.role = "جار"
            token.explanation = lx.PREPOSITIONS[key] + "، مبني لا محل له من الإعراب."
            token.confidence = 0.98
        elif key in lx.CONJUNCTIONS:
            token.kind = "حرف عطف"
            token.role = "عاطف"
            token.explanation = lx.CONJUNCTIONS[key] + "، مبني لا محل له من الإعراب."
            token.confidence = 0.93
        elif key in lx.VOCATIVE_PARTICLES:
            token.kind = "حرف نداء"
            token.role = "أداة نداء"
            token.explanation = "حرف نداء مبني لا محل له من الإعراب."
            token.confidence = 0.98
        elif key in lx.EXCEPTION_PARTICLES:
            token.kind = "أداة استثناء"
            token.role = "أداة استثناء"
            token.explanation = "أداة استثناء؛ يتحدد عملها من تمام الكلام وإثباته."
            token.confidence = 0.94
        elif key in lx.QUESTION_PARTICLES:
            token.kind = "أداة استفهام"
            token.role = "استفهام"
            token.explanation = "أداة استفهام؛ يتحدد محل الاسم منها بحسب السياق."
            token.confidence = 0.78
        elif key in lx.DEMONSTRATIVES:
            token.kind = "اسم إشارة"
            token.explanation = "اسم إشارة مبني، ويتحدد محله الإعرابي من السياق."
            token.confidence = 0.94
        elif key in lx.RELATIVES:
            token.kind = "اسم موصول"
            token.explanation = "اسم موصول مبني، ويتحدد محله الإعرابي من السياق."
            token.confidence = 0.80
        elif key in lx.PRONOUNS:
            token.kind = "ضمير"
            token.explanation = "ضمير منفصل مبني، ويتحدد محله الإعرابي من السياق."
            token.confidence = 0.96
        elif key in lx.IMPERATIVE_VERBS:
            token.kind = "فعل أمر"
            token.role = "فعل"
            token.state = "مبني"
            token.sign = "السكون أو حذف حرف العلة/النون بحسب صيغته"
            token.explanation = "فعل أمر مبني، وفاعله ضمير مستتر أو متصل بحسب الصيغة."
            token.confidence = 0.92
        elif _looks_present(key):
            token.kind = "فعل مضارع"
            token.role = "فعل"
            token.state = "مرفوع"
            token.sign = _verb_sign(word, "مرفوع")
            token.explanation = "فعل مضارع مرفوع لتجرده مبدئيًا من الناصب والجازم."
            token.confidence = 0.84
        elif _past_root(key):
            token.kind = "فعل ماض"
            token.role = "فعل"
            token.state = "مبني"
            token.sign = "الفتح الظاهر أو ما ينوب عنه بحسب اتصال الضمائر"
            token.explanation = "فعل ماض مبني لا محل له من الإعراب."
            token.confidence = 0.91
        elif key in lx.ADJECTIVES or _stem_for_lookup(word) in lx.ADJECTIVES:
            token.kind = "صفة"
            token.explanation = "اسم مشتق، ويكون نعتًا إذا وافق اسمًا قبله أو خبرًا بحسب السياق."
            token.confidence = 0.82
        elif key in lx.ADVERBS:
            token.kind = "ظرف"
            token.role = "ظرف"
            token.state = "منصوب"
            token.sign = _case_sign(word, "منصوب")
            token.explanation = "ظرف زمان أو مكان منصوب، وهو مضاف غالبًا."
            token.confidence = 0.82
        else:
            token.kind = "اسم"
            token.explanation = "اسم معرب؛ حُدد موقعه من ترتيب الجملة والعوامل الداخلة عليه."
            token.confidence = 0.74 if key not in lx.NOUN_HINTS else 0.88

        prefixes, stem = without_common_prefix(word)
        if prefixes:
            labels = {"و": "واو متصلة", "ف": "فاء متصلة", "ب": "باء الجر متصلة", "ك": "كاف الجر متصلة", "ل": "لام متصلة"}
            token.features.extend(labels[p] for p in prefixes)
        if has_definite_article(word):
            token.features.append("معرّف بأل")
        if stem.endswith("ة"):
            token.features.append("مؤنث")
        return token

    def _resolve_ambiguous_particles(self, tokens: list[TokenAnalysis], content: list[int], level: str) -> None:
        for order, idx in enumerate(content):
            token = tokens[idx]
            key = token.normalized
            bare = _bare(token.word)
            next_token = tokens[content[order + 1]] if order + 1 < len(content) else None
            later_verbs = sum(t.kind == "فعل مضارع" for t in (tokens[j] for j in content[order + 1 :]))

            if bare == "أن" and next_token and next_token.kind == "فعل مضارع":
                token.kind = "حرف نصب"
                token.role = "ناصب"
                token.explanation = "حرف مصدري ونصب مبني لا محل له من الإعراب."
                token.confidence = 0.97
            elif bare == "إن" and next_token and next_token.kind == "فعل مضارع" and later_verbs >= 2 and LEVEL_RANK[level] >= 3:
                token.kind = "أداة شرط"
                token.role = "جازم لفعلين"
                token.explanation = "حرف شرط جازم مبني لا محل له من الإعراب."
                token.confidence = 0.91
            elif key in lx.CONDITIONAL_PARTICLES and order == 0 and later_verbs >= 2 and LEVEL_RANK[level] >= 3:
                token.kind = "أداة شرط"
                token.role = "جازم لفعلين"
                token.explanation = lx.CONDITIONAL_PARTICLES[key] + "."
                token.confidence = 0.86
            elif key in {"لن", "كي", "اذن", "حتى"} and next_token and next_token.kind == "فعل مضارع":
                token.kind = "حرف نصب"
                token.role = "ناصب"
                token.explanation = lx.SUBJUNCTIVE_PARTICLES[key] + "، مبني لا محل له."
                token.confidence = 0.95
            elif key in {"لم", "لما"} and next_token and next_token.kind == "فعل مضارع":
                token.kind = "حرف جزم"
                token.role = "جازم"
                token.explanation = lx.JUSSIVE_PARTICLES[key] + "، مبني لا محل له."
                token.confidence = 0.96
            elif key == "لا" and next_token and next_token.kind == "فعل مضارع":
                token.kind = "حرف جزم"
                token.role = "ناهي أو نافي"
                token.explanation = "تُعامل هنا على أنها لا الناهية الجازمة؛ وقد تكون نافية إن لم يفد السياق طلب الكف."
                token.confidence = 0.69
            elif key == "ما" and token.kind in {"أداة استفهام", "اسم موصول", "اسم"} and next_token:
                token.kind = "حرف نفي"
                token.role = "نافي"
                token.explanation = "حرف نفي مبني لا محل له من الإعراب بحسب السياق المرجح."
                token.confidence = 0.69

    def _sentence_type(self, tokens: list[TokenAnalysis], content: list[int]) -> str:
        meaningful = [tokens[i] for i in content]
        first = meaningful[0]
        if first.kind == "أداة شرط":
            return "أسلوب شرط"
        if first.kind == "حرف نداء":
            return "أسلوب نداء تتلوه جملة"

        # نتجاوز الاستفهام والنفي والعطف للعثور على صدر الجملة الحقيقي.
        core = [
            t
            for t in meaningful
            if t.kind not in {"أداة استفهام", "حرف نفي", "حرف عطف", "حرف نصب", "حرف جزم"}
        ]
        if not core:
            return "تركيب غير مكتمل"
        head = core[0]
        if head.kind == "حرف ناسخ":
            return "جملة اسمية منسوخة بإن وأخواتها"
        if head.kind == "فعل ناقص":
            return "جملة اسمية منسوخة بكان وأخواتها"
        if head.kind.startswith("فعل"):
            return "جملة فعلية"
        return "جملة اسمية"

    def _apply_particle_government(self, tokens: list[TokenAnalysis], content: list[int], level: str) -> None:
        for order, idx in enumerate(content[:-1]):
            token = tokens[idx]
            nxt = tokens[content[order + 1]]
            if token.kind == "حرف نصب" and nxt.kind == "فعل مضارع":
                self._assign_verb(nxt, "منصوب", f"فعل مضارع منصوب بـ«{token.word}»")
            elif token.kind == "حرف جزم" and nxt.kind == "فعل مضارع":
                self._assign_verb(nxt, "مجزوم", f"فعل مضارع مجزوم بـ«{token.word}»")

        # حروف الجر المتصلة: بالبيت، للطالب، كالأسد.
        for token in tokens:
            if not _is_nominal(token):
                continue
            prefixes, _ = without_common_prefix(token.word)
            prep = next((p for p in prefixes if p in "بكل"), None)
            if prep:
                self._assign_nominal(token, "اسم مجرور", "مجرور", f"اسم مجرور بحرف الجر المتصل «{prep}»")
                token.confidence = max(token.confidence, 0.91)

    def _assign_nominal(self, token: TokenAnalysis, role: str, state: str, reason: str, confidence: float = 0.88) -> None:
        token.role = role
        token.state = state
        token.sign = _case_sign(token.word, state)
        action = {"مرفوع": "رفعه", "منصوب": "نصبه", "مجرور": "جره", "مجزوم": "جزمه"}.get(state, "إعرابه")
        token.explanation = f"{reason}، وعلامة {action} {token.sign}." if token.sign else f"{reason}."
        token.confidence = max(token.confidence, confidence)

    def _assign_verb(self, token: TokenAnalysis, state: str, reason: str, confidence: float = 0.90) -> None:
        token.role = "فعل"
        token.state = state
        token.sign = _verb_sign(token.word, state)
        action = {"مرفوع": "رفعه", "منصوب": "نصبه", "مجزوم": "جزمه"}.get(state, "إعرابه")
        token.explanation = f"{reason}، وعلامة {action} {token.sign}."
        token.confidence = max(token.confidence, confidence)

    def _next_nominals(self, tokens: list[TokenAnalysis], content: list[int], start_order: int) -> list[TokenAnalysis]:
        return [tokens[i] for i in content[start_order:] if _is_nominal(tokens[i]) and tokens[i].role not in {"اسم مجرور"}]

    def _parse_inna(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        head_order = next((n for n, i in enumerate(content) if tokens[i].kind == "حرف ناسخ"), 0)
        nominals = self._next_nominals(tokens, content, head_order + 1)
        if nominals:
            self._assign_nominal(nominals[0], "اسم الحرف الناسخ", "منصوب", "اسم الحرف الناسخ منصوب", 0.95)
        if len(nominals) > 1:
            self._assign_nominal(nominals[1], "خبر الحرف الناسخ", "مرفوع", "خبر الحرف الناسخ مرفوع", 0.93)

    def _parse_kana(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        head_order = next((n for n, i in enumerate(content) if tokens[i].kind == "فعل ناقص"), 0)
        nominals = self._next_nominals(tokens, content, head_order + 1)
        if nominals:
            self._assign_nominal(nominals[0], "اسم الفعل الناسخ", "مرفوع", "اسم الفعل الناسخ مرفوع", 0.95)
        if len(nominals) > 1:
            self._assign_nominal(nominals[1], "خبر الفعل الناسخ", "منصوب", "خبر الفعل الناسخ منصوب", 0.93)

    def _parse_verbal(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        verb_order = next((n for n, i in enumerate(content) if tokens[i].kind in {"فعل ماض", "فعل مضارع", "فعل أمر"}), None)
        if verb_order is None:
            return
        verb = tokens[content[verb_order]]
        if verb.kind == "فعل مضارع" and verb.state not in {"منصوب", "مجزوم"}:
            self._assign_verb(verb, "مرفوع", "فعل مضارع مرفوع لتجرده من الناصب والجازم", 0.90)
        candidates: list[TokenAnalysis] = []
        for idx in content[verb_order + 1 :]:
            token = tokens[idx]
            if token.kind in {"حرف جر", "حرف نصب", "حرف جزم", "حرف عطف"}:
                continue
            if _is_nominal(token) and token.role != "اسم مجرور":
                candidates.append(token)
        if candidates:
            self._assign_nominal(candidates[0], "فاعل", "مرفوع", "فاعل مرفوع", 0.91)
        if len(candidates) > 1:
            self._assign_nominal(candidates[1], "مفعول به", "منصوب", "مفعول به منصوب", 0.86)

    def _parse_nominal(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        nominals = [tokens[i] for i in content if _is_nominal(tokens[i]) and tokens[i].role != "اسم مجرور"]
        if not nominals:
            return
        # الجار والمجرور في صدر الجملة خبر مقدم، وما بعده مبتدأ مؤخر.
        first_content = tokens[content[0]]
        if first_content.kind == "حرف جر" and nominals:
            self._assign_nominal(nominals[-1], "مبتدأ مؤخر", "مرفوع", "مبتدأ مؤخر مرفوع", 0.90)
            return
        self._assign_nominal(nominals[0], "مبتدأ", "مرفوع", "مبتدأ مرفوع", 0.92)
        if len(nominals) > 1:
            self._assign_nominal(nominals[1], "خبر", "مرفوع", "خبر المبتدأ مرفوع", 0.88)

    def _parse_prepositional_phrases(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for order, idx in enumerate(content[:-1]):
            token = tokens[idx]
            if token.kind != "حرف جر":
                continue
            nxt = tokens[content[order + 1]]
            if _is_nominal(nxt):
                self._assign_nominal(nxt, "اسم مجرور", "مجرور", f"اسم مجرور بـ«{token.word}»", 0.96)
                if order == 0:
                    token.features.append("متعلق بخبر مقدم محذوف")
                else:
                    token.features.append("متعلق بما قبله")

    def _parse_idafa(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for order in range(len(content) - 1):
            first = tokens[content[order]]
            second = tokens[content[order + 1]]
            if not (_is_nominal(first) and _is_nominal(second)):
                continue
            if first.kind in {"ضمير", "اسم إشارة", "اسم موصول", "صفة"}:
                continue
            # اسم نكرة يليه اسم معرفة قرينة قوية على الإضافة: كتاب الطالب.
            if not _is_definite(first.word, first.kind) and _is_definite(second.word, second.kind):
                if first.role in {"مبتدأ", "فاعل", "مفعول به", "خبر", "اسم الحرف الناسخ", "اسم الفعل الناسخ"}:
                    displaced_role = second.role
                    first.features.append("مضاف")
                    self._assign_nominal(second, "مضاف إليه", "مجرور", "مضاف إليه مجرور", 0.91)
                    # كان الاسم الثاني قد شغل مكان الخبر/المفعول مبدئيًا؛ ننقل الموقع إلى ما بعد تمام الإضافة.
                    role_state = {
                        "خبر": ("خبر", "مرفوع", "خبر المبتدأ مرفوع"),
                        "خبر الحرف الناسخ": ("خبر الحرف الناسخ", "مرفوع", "خبر الحرف الناسخ مرفوع"),
                        "خبر الفعل الناسخ": ("خبر الفعل الناسخ", "منصوب", "خبر الفعل الناسخ منصوب"),
                        "مفعول به": ("مفعول به", "منصوب", "مفعول به منصوب"),
                    }.get(displaced_role)
                    if role_state:
                        for later_idx in content[order + 2 :]:
                            later = tokens[later_idx]
                            if _is_nominal(later) and later.role in {"غير محدد", "اسم بحسب السياق"}:
                                self._assign_nominal(later, *role_state, confidence=0.86)
                                break

    def _parse_adjectives(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for order in range(1, len(content)):
            current = tokens[content[order]]
            previous = tokens[content[order - 1]]
            if current.kind != "صفة" or not _is_nominal(previous):
                continue
            same_definition = _is_definite(current.word, current.kind) == _is_definite(previous.word, previous.kind)
            if same_definition and previous.state in {"مرفوع", "منصوب", "مجرور"}:
                displaced_role = current.role
                self._assign_nominal(current, "نعت", previous.state, f"نعت {previous.state} يتبع منعوته", 0.90)
                role_state = {
                    "خبر": ("خبر", "مرفوع", "خبر المبتدأ مرفوع"),
                    "خبر الحرف الناسخ": ("خبر الحرف الناسخ", "مرفوع", "خبر الحرف الناسخ مرفوع"),
                    "خبر الفعل الناسخ": ("خبر الفعل الناسخ", "منصوب", "خبر الفعل الناسخ منصوب"),
                    "مفعول به": ("مفعول به", "منصوب", "مفعول به منصوب"),
                }.get(displaced_role)
                if role_state:
                    for later_idx in content[order + 1 :]:
                        later = tokens[later_idx]
                        if _is_nominal(later) and later.role in {"غير محدد", "اسم بحسب السياق"}:
                            self._assign_nominal(later, *role_state, confidence=0.85)
                            break

    def _parse_conjunctions(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for order, idx in enumerate(content):
            conjunction = tokens[idx]
            if conjunction.kind != "حرف عطف" or order == 0 or order + 1 >= len(content):
                continue
            before = tokens[content[order - 1]]
            after = tokens[content[order + 1]]
            if _is_nominal(after) and before.state in {"مرفوع", "منصوب", "مجرور"}:
                self._assign_nominal(after, "معطوف", before.state, f"معطوف {before.state} يتبع المعطوف عليه", 0.89)

    def _parse_conditional(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        verbs = [tokens[i] for i in content if tokens[i].kind == "فعل مضارع"]
        if verbs:
            self._assign_verb(verbs[0], "مجزوم", "فعل الشرط مجزوم", 0.94)
            verbs[0].role = "فعل الشرط"
        if len(verbs) > 1:
            self._assign_verb(verbs[1], "مجزوم", "جواب الشرط مجزوم", 0.92)
            verbs[1].role = "جواب الشرط"

    def _parse_vocative(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        if len(content) < 2:
            return
        called = tokens[content[1]]
        if not _is_nominal(called):
            return
        if has_definite_article(called.word):
            called.role = "منادى"
            called.state = "منصوب تقديرًا"
            called.sign = "يحتاج المنادى المعرّف بأل عادةً إلى «أيها/أيتها»"
            called.explanation = "منادى؛ والصياغة القياسية للمعرّف بأل أن يسبق بـ«أيها» أو «أيتها»."
            called.confidence = 0.72
        else:
            called.role = "منادى"
            called.state = "مبني في محل نصب"
            called.sign = "الضمة إن كان مفردًا معرفة مقصودة، وإلا فالفتحة"
            called.explanation = "منادى مبني على ما يرفع به في محل نصب، مع احتمال النكرة غير المقصودة بحسب السياق."
            called.confidence = 0.81

    def _parse_remaining_clause(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        rest = content[2:]
        if not rest:
            return
        if any(tokens[i].kind.startswith("فعل") for i in rest):
            self._parse_verbal(tokens, rest)
        else:
            self._parse_nominal(tokens, rest)

    def _parse_exception(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for order, idx in enumerate(content[:-1]):
            marker = tokens[idx]
            if marker.kind != "أداة استثناء":
                continue
            excluded = tokens[content[order + 1]]
            if not _is_nominal(excluded):
                continue
            if marker.normalized == "الا":
                self._assign_nominal(excluded, "مستثنى", "منصوب", "مستثنى بإلا منصوب في الكلام التام المثبت", 0.85)
            else:
                self._assign_nominal(excluded, "مضاف إليه", "مجرور", f"مضاف إليه مجرور بعد «{marker.word}»", 0.89)
                marker.features.append("اسم واقع موقع المستثنى وهو مضاف")

    def _parse_relatives(self, tokens: list[TokenAnalysis], content: list[int]) -> None:
        for idx in content:
            token = tokens[idx]
            if token.kind == "اسم موصول":
                token.features.append("تحتاج صلته إلى عائد")
                if token.role == "غير محدد":
                    token.role = "اسم موصول"
                    token.explanation = "اسم موصول مبني؛ الجملة بعده صلة الموصول لا محل لها من الإعراب."

    def _finish_unassigned(self, tokens: list[TokenAnalysis]) -> None:
        for token in tokens:
            if token.role != "غير محدد":
                continue
            if token.kind in {"اسم", "صفة", "ضمير", "اسم إشارة", "اسم موصول"}:
                token.role = "اسم بحسب السياق"
                token.explanation = "اسم؛ تعذر الجزم بموقعه من السياق القصير، فاعرض جملة تامة أو اضبط أواخر الكلمات."
                token.confidence = min(token.confidence, 0.60)
            elif token.kind.startswith("فعل"):
                token.role = "فعل"

    def _ambiguity_notes(self, tokens: list[TokenAnalysis]) -> list[str]:
        notes: list[str] = []
        if any(t.confidence < 0.72 for t in tokens if t.kind != "علامة ترقيم"):
            notes.append("بعض الكلمات تحتمل أكثر من وجه؛ إضافة الحركات أو توسيع الجملة ترفع دقة الترجيح.")
        if any(t.normalized == "لا" and t.role == "ناهي أو نافي" for t in tokens):
            notes.append("«لا» قبل المضارع قد تكون ناهية جازمة أو نافية غير عاملة؛ رُجّح النهي آليًا.")
        return notes

    def _summary(self, sentence_type: str, tokens: list[TokenAnalysis]) -> str:
        roles = [t.role for t in tokens]
        if sentence_type == "جملة فعلية":
            if "مفعول به" in roles:
                return "جملة فعلية رُصد فيها فعل وفاعل ومفعول به، مع تطبيق العامل وعلامة الإعراب على كل كلمة."
            return "جملة فعلية قوامها فعل وفاعل ظاهر أو مقدّر، وقد أُلحقت بها المكملات المرصودة."
        if sentence_type.startswith("جملة اسمية منسوخة بإن"):
            return "جملة اسمية دخل عليها حرف ناسخ: نُصب الاسم ورُفع الخبر."
        if sentence_type.startswith("جملة اسمية منسوخة بكان"):
            return "جملة اسمية دخل عليها فعل ناسخ: رُفع الاسم ونُصب الخبر."
        if sentence_type == "أسلوب شرط":
            return "أسلوب شرط جازم: جُزم فعل الشرط وجوابه بحسب الصيغة المرصودة."
        if sentence_type.startswith("أسلوب نداء"):
            return "أسلوب نداء حُدد فيه المنادى، ثم حُللت الجملة التالية له."
        if sentence_type == "جملة اسمية":
            return "جملة اسمية قوامها مبتدأ وخبر، مع تحليل ما اتصل بها من متممات."
        return "تحليل صرفي ونحوي مرجّح للكلمات المدخلة."
