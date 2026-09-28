from __future__ import annotations

import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from arabic_parser.server import create_server


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = create_server("127.0.0.1", 0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def test_health(self) -> None:
        with urlopen(f"{self.base}/api/health", timeout=2) as response:
            data = json.load(response)
        self.assertTrue(data["ok"])
        self.assertTrue(data["offline"])

    def test_parse_endpoint(self) -> None:
        request = Request(
            f"{self.base}/api/parse",
            data=json.dumps({"text": "العلم نور", "level": "auto"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=2) as response:
            data = json.load(response)
        self.assertEqual(data["sentenceType"], "جملة اسمية")
        self.assertEqual(data["tokens"][0]["role"], "مبتدأ")

    def test_bad_request_is_json(self) -> None:
        request = Request(
            f"{self.base}/api/parse",
            data=b'{"text":""}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as raised:
            urlopen(request, timeout=2)
        self.assertEqual(raised.exception.code, 400)
        data = json.loads(raised.exception.read().decode("utf-8"))
        self.assertIn("error", data)


if __name__ == "__main__":
    unittest.main()
