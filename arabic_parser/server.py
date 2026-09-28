"""خادم HTTP محلي خفيف للواجهة؛ يعتمد على مكتبة بايثون القياسية فقط."""

from __future__ import annotations

import json
import mimetypes
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .engine import ArabicGrammarEngine, _resource_root

ENGINE = ArabicGrammarEngine()
EXAMPLES = [
    {"level": "easy", "label": "جملة فعلية", "text": "كتبَ الطالبُ الدرسَ."},
    {"level": "easy", "label": "جملة اسمية", "text": "العلمُ نورٌ."},
    {"level": "medium", "label": "إن وأخواتها", "text": "إنَّ الطالبَ مجتهدٌ."},
    {"level": "medium", "label": "كان وأخواتها", "text": "كان الجوُّ جميلًا."},
    {"level": "medium", "label": "نصب المضارع", "text": "لن يهملَ الطالبُ واجبَه."},
    {"level": "hard", "label": "أسلوب شرط", "text": "إنْ تجتهدْ تنجحْ."},
    {"level": "hard", "label": "استثناء", "text": "حضرَ الطلابُ إلا طالبًا."},
]


class GrammarRequestHandler(SimpleHTTPRequestHandler):
    """يخدم ملفات الواجهة ومسارات JSON من العملية المحلية نفسها."""

    server_version = "Mi3rab/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        web_root = _resource_root() / "web"
        super().__init__(*args, directory=str(web_root), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        # لا نطبع نصوص المستخدم في سجل تطبيق سطح المكتب.
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self'; "
            "script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors *",
        )
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        route = urlparse(self.path).path
        if route == "/api/health":
            self._json({"ok": True, "offline": True, "version": ENGINE.version})
            return
        if route == "/api/models":
            self._json({"models": ENGINE.model_info()})
            return
        if route == "/api/examples":
            self._json({"examples": EXAMPLES})
            return
        if route == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        route = urlparse(self.path).path
        if route != "/api/parse":
            self._json({"error": "المسار غير موجود."}, HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384:
                raise ValueError("حجم الطلب غير صالح.")
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("صيغة الطلب غير صحيحة.")
            text = payload.get("text", "")
            level = payload.get("level", "auto")
            if not isinstance(text, str) or not isinstance(level, str):
                raise ValueError("النص أو المستوى غير صالح.")
            result = ENGINE.parse(text, level)
            self._json(result.to_dict())
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception:
            # لا نسرّب تفاصيل داخلية إلى الواجهة.
            self._json({"error": "تعذر إكمال التحليل. حاول تبسيط الجملة ثم أعد المحاولة."}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _json(self, data: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def create_server(host: str = "127.0.0.1", port: int = 0) -> LocalServer:
    return LocalServer((host, port), GrammarRequestHandler)
