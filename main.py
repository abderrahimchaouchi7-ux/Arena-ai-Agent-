"""نقطة تشغيل مِعْراب لسطح المكتب أو وضع خادم التطوير."""

from __future__ import annotations

import argparse
import sys
import threading
import webbrowser

from arabic_parser.server import create_server


def serve(host: str, port: int) -> None:
    server = create_server(host, port)
    address, actual_port = server.server_address[:2]
    print(f"مِعْراب يعمل على http://{address}:{actual_port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def desktop() -> None:
    server = create_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, name="mi3rab-local-server", daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}"

    try:
        import webview  # type: ignore[import-not-found]

        webview.create_window(
            "مِعْراب — الإعراب العربي الذكي",
            url,
            width=1280,
            height=820,
            min_size=(920, 640),
            text_select=True,
            background_color="#F5F2EA",
        )
        webview.start(debug=False, private_mode=True)
    except ImportError:
        # مفيد عند تشغيل المصدر من دون تبعيات الواجهة؛ الحزمة الرسمية تضم pywebview.
        print("لم تُثبت pywebview؛ ستُفتح الواجهة في المتصفح الافتراضي.")
        webbrowser.open(url)
        try:
            thread.join()
        except KeyboardInterrupt:
            pass
    finally:
        server.shutdown()
        server.server_close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="مِعْراب: محلل نحوي عربي يعمل دون إنترنت")
    parser.add_argument("--serve", action="store_true", help="تشغيل خادم الويب فقط")
    parser.add_argument("--host", default="127.0.0.1", help="عنوان الاستماع في وضع الخادم")
    parser.add_argument("--port", type=int, default=8765, help="منفذ وضع الخادم")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.serve:
        serve(args.host, args.port)
    else:
        desktop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
