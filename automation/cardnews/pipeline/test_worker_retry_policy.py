from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class WorkerRetryPolicyTest(unittest.TestCase):
    def test_validation_retries_are_bounded_per_delivery_and_ten_overall(self) -> None:
        source = (ROOT / "src" / "index.ts").read_text(encoding="utf-8")
        self.assertGreaterEqual(source.count("attempt <= 2"), 2)
        self.assertIn("message.attempts >= 10", source)
        self.assertNotRegex(source, r"nonRetryable\s*=\s*/[^/]*(?:문체|문장|제목|프롬프트)[^/]*/")

    def test_queue_retry_budget_is_ten(self) -> None:
        config = json.loads((ROOT / "wrangler.template.jsonc").read_text(encoding="utf-8"))
        consumer = config["queues"]["consumers"][0]
        self.assertEqual(consumer["max_retries"], 10)

    def test_external_provider_is_opt_in_but_covers_text_image_and_vision(self) -> None:
        source = (ROOT / "src" / "index.ts").read_text(encoding="utf-8")
        config = json.loads((ROOT / "wrangler.template.jsonc").read_text(encoding="utf-8"))
        variables = config["vars"]
        self.assertEqual(variables["FREE_ONLY_MODE"], "true")
        self.assertEqual(variables["TEXT_PROVIDER"], "horde")
        self.assertEqual(variables["IMAGE_PROVIDER"], "pollinations")
        self.assertEqual(variables["IMAGE_FALLBACK_PROVIDER"], "horde")
        self.assertEqual(variables["VISION_PROVIDER"], "off")
        self.assertIn("/v2/generate/text/async", source)
        self.assertIn("/v2/generate/async", source)
        self.assertIn("image.pollinations.ai", source)
        self.assertIn("FREE_ONLY_MODE에서는", source)
        self.assertIn("/chat/completions", source)  # paid provider remains an explicit opt-in
        self.assertIn("runVisionModel", source)
        self.assertIn("OPENAI_API_KEY", source)


if __name__ == "__main__":
    unittest.main()
