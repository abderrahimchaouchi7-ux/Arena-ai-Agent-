"""تطبيع النص العربي وتقطيعه من دون أي مكتبات خارجية."""

from __future__ import annotations

import re
import unicodedata

# يشمل حركات المصحف الشائعة مع إبقاء الحرف الأصلي كما كتبه المستخدم.
_DIACRITICS_RE = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
_TOKEN_RE = re.compile(
    # نطاقات الحروف والحركات فقط؛ استبعاد «،؛؟» يمنع التصاقها بالكلمة.
    r"[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06FA-\u06FC\u0750-\u077F\u08A0-\u08C9"
    r"\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]+|"
    r"[A-Za-z]+(?:[-'][A-Za-z]+)*|\d+(?:[.,]\d+)?|[^\s]",
    re.UNICODE,
)
_PUNCTUATION = set("،؛؟!.,:;…()[]{}«»\"'ـ-—")


def strip_diacritics(text: str) -> str:
    """يحذف الحركات مع إبقاء بنية الكلمة."""
    return _DIACRITICS_RE.sub("", unicodedata.normalize("NFC", text)).replace("ـ", "")


def normalize_word(word: str) -> str:
    """ينتج مفتاح بحث موحّدًا ولا يغيّر النص المعروض للمستخدم."""
    word = strip_diacritics(word).strip()
    return word.translate(
        str.maketrans(
            {
                "أ": "ا",
                "إ": "ا",
                "آ": "ا",
                "ٱ": "ا",
                "ؤ": "و",
                "ئ": "ي",
                "ى": "ي",
            }
        )
    )


def tokenize(text: str) -> list[str]:
    """يفصل الكلمات وعلامات الترقيم، ويمنع الفراغات من الظهور كرموز."""
    return _TOKEN_RE.findall(unicodedata.normalize("NFC", text.strip()))


def is_punctuation(token: str) -> bool:
    return bool(token) and all(char in _PUNCTUATION for char in token)


def has_definite_article(word: str) -> bool:
    key = normalize_word(word)
    if key.startswith("ال") and len(key) > 3:
        return True
    # الواو/الفاء/الباء/الكاف/اللام قبل أل.
    return len(key) > 4 and key[0] in "وفبكل" and key[1:3] == "ال"


def without_common_prefix(word: str) -> tuple[list[str], str]:
    """يفصل السوابق الواضحة قبل «أل» من غير أن يفسد كلمات مثل «كتاب» و«فاطمة».

    السوابق مع النكرة أشد التباسًا بلا معجم شامل، لذلك يتركها المحرّك محافظةً
    على الدقة، ويحلل الصور غير الملتبسة: والـ، فالـ، بالـ، كالـ، واللام في «للـ».
    """
    key = normalize_word(word)
    prefixes: list[str] = []
    if key.startswith(("وال", "فال")) and len(key) > 4:
        prefixes.append(key[0])
        key = key[1:]
    if key.startswith(("بال", "كال")) and len(key) > 4:
        prefixes.append(key[0])
        key = key[1:]
    elif key.startswith("لل") and len(key) > 3:
        prefixes.append("ل")
        key = "ال" + key[2:]
    return prefixes, key
