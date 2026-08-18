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

    def test_chatgpt_handoff_preserves_human_review_before_rendering(self) -> None:
        source = (ROOT / "src" / "index.ts").read_text(encoding="utf-8")
        self.assertIn("/api/report-published", source)
        self.assertIn("sendChatGptPackage", source)
        self.assertIn("import_chatgpt_json", source)
        self.assertIn("MANUAL_IMAGE_UPLOADING", source)
        self.assertIn("storeManualImage", source)
        self.assertIn("SRC_PLUS_GPT_INSTRUCTIONS.md", source)
        self.assertIn("action === 'hs'", source)
        self.assertIn("mode: 'chatgpt' | 'legacy'", source)

    def test_custom_gpt_can_only_read_published_root_reports_with_an_action_key(self) -> None:
        source = (ROOT / "src" / "index.ts").read_text(encoding="utf-8")
        schema = (ROOT / "chatgpt" / "SRC_PLUS_GPT_ACTION.openapi.yaml").read_text(encoding="utf-8")
        self.assertIn("/api/gpt/reports", source)
        self.assertIn("/api/gpt/report", source)
        self.assertIn("GPT_ACTION_TOKEN", source)
        self.assertIn("x-srcplus-action-key", source)
        self.assertIn("meta?.published", source)
        self.assertIn("listGitHubReportFiles", schema)
        self.assertIn("getGitHubReportHtml", schema)
        self.assertIn("api.github.com", schema)
        self.assertIn("raw.githubusercontent.com", schema)

    def test_git_notification_workflow_only_notifies_added_or_modified_reports(self) -> None:
        workflow = (ROOT.parents[1] / ".github" / "workflows" / "cardnews-new-report-notify.yml").read_text(encoding="utf-8")
        self.assertIn("reports_*.html", workflow)
        self.assertIn("--diff-filter=AM", workflow)
        self.assertIn("report_notification.py", workflow)


if __name__ == "__main__":
    unittest.main()
