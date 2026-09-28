from __future__ import annotations

import unittest

from arabic_parser.engine import ArabicGrammarEngine
from arabic_parser.text import normalize_word, tokenize


class TextTests(unittest.TestCase):
    def test_tokenizer_separates_arabic_punctuation(self) -> None:
        self.assertEqual(tokenize("كتبَ الطالبُ، ثم عاد."), ["كتبَ", "الطالبُ", "،", "ثم", "عاد", "."])

    def test_normalization_preserves_searchable_letters(self) -> None:
        self.assertEqual(normalize_word("إِنَّ"), "ان")
        self.assertEqual(normalize_word("عَلَى"), "علي")


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = ArabicGrammarEngine()

    def roles(self, sentence: str, level: str = "auto") -> dict[str, str]:
        result = self.engine.parse(sentence, level)
        return {token.word: token.role for token in result.tokens}

    def test_simple_verbal_sentence(self) -> None:
        result = self.engine.parse("كتبَ الطالبُ الدرسَ.")
        self.assertEqual(result.sentence_type, "جملة فعلية")
        self.assertEqual(result.detected_level, "easy")
        self.assertEqual(result.tokens[1].role, "فاعل")
        self.assertEqual(result.tokens[2].role, "مفعول به")

    def test_simple_nominal_sentence(self) -> None:
        roles = self.roles("العلمُ نورٌ")
        self.assertEqual(roles["العلمُ"], "مبتدأ")
        self.assertEqual(roles["نورٌ"], "خبر")

    def test_inna_governs_its_nouns(self) -> None:
        result = self.engine.parse("إنَّ العلمَ نافعٌ")
        self.assertIn("بإن", result.sentence_type)
        self.assertEqual(result.tokens[1].state, "منصوب")
        self.assertEqual(result.tokens[2].state, "مرفوع")

    def test_kana_governs_its_nouns(self) -> None:
        result = self.engine.parse("كان الجوُّ جميلًا")
        self.assertIn("بكان", result.sentence_type)
        self.assertEqual(result.tokens[1].role, "اسم الفعل الناسخ")
        self.assertEqual(result.tokens[2].state, "منصوب")

    def test_initial_prepositional_phrase(self) -> None:
        result = self.engine.parse("في البيتِ طفلٌ")
        self.assertEqual(result.tokens[1].role, "اسم مجرور")
        self.assertEqual(result.tokens[2].role, "مبتدأ مؤخر")

    def test_subjunctive_present(self) -> None:
        result = self.engine.parse("لن يهملَ الطالبُ واجبَه")
        self.assertEqual(result.sentence_type, "جملة فعلية")
        self.assertEqual(result.tokens[1].state, "منصوب")
        self.assertEqual(result.tokens[2].role, "فاعل")

    def test_conditional_routes_to_hard_model(self) -> None:
        result = self.engine.parse("إنْ تجتهدْ تنجحْ")
        self.assertEqual(result.detected_level, "hard")
        self.assertEqual(result.sentence_type, "أسلوب شرط")
        self.assertEqual(result.tokens[1].role, "فعل الشرط")
        self.assertEqual(result.tokens[2].role, "جواب الشرط")

    def test_exception(self) -> None:
        result = self.engine.parse("حضرَ الطلابُ إلا طالبًا")
        self.assertEqual(result.detected_level, "hard")
        self.assertEqual(result.tokens[3].role, "مستثنى")
        self.assertEqual(result.tokens[3].state, "منصوب")

    def test_dual_uses_secondary_case_sign(self) -> None:
        result = self.engine.parse("جاء الطالبان")
        self.assertEqual(result.tokens[1].role, "فاعل")
        self.assertIn("الألف", result.tokens[1].sign)
        self.assertIn("مثنى", result.tokens[1].sign)

    def test_idafa_does_not_consume_predicate(self) -> None:
        result = self.engine.parse("كتابُ الطالبِ مفيدٌ", "medium")
        self.assertEqual(result.tokens[1].role, "مضاف إليه")
        self.assertEqual(result.tokens[2].role, "خبر")

    def test_adjective_does_not_consume_predicate(self) -> None:
        result = self.engine.parse("الطالبُ المجتهدُ ناجحٌ", "medium")
        self.assertEqual(result.tokens[1].role, "نعت")
        self.assertEqual(result.tokens[2].role, "خبر")

    def test_rejects_empty_and_oversized_input(self) -> None:
        with self.assertRaises(ValueError):
            self.engine.parse("   ")
        with self.assertRaises(ValueError):
            self.engine.parse("ا" * 1001)


if __name__ == "__main__":
    unittest.main()
