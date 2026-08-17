from __future__ import annotations

import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory
from pathlib import Path

from run_local_pipeline import OllamaClient, OpenCodexClient, compact_source, copy_manifest, copy_schema, load_valid_checkpoint, validate_visuals


class LocalPipelineTest(unittest.TestCase):
    def test_copy_manifest_maps_copy_pages(self) -> None:
        draft = {
            "report_title": "제목",
            "category": "issues",
            "cover": {"title": "표지 제목", "subtitle": "충분히 긴 표지 부제 문장이다"},
            "body_pages": [{"title": f"본문 제목 {index}", "body": "충분한 길이의 본문 문장이다."} for index in range(1, 5)],
            "cta_subject": "CTA 주제",
        }
        pages = copy_manifest(draft)["pages"]
        self.assertEqual(6, len(pages))
        self.assertEqual("cover", pages[0]["page_kind"])
        self.assertEqual("cta", pages[-1]["page_kind"])

    def test_visual_validator_rejects_short_prompt(self) -> None:
        with self.assertRaisesRegex(ValueError, "110~150"):
            validate_visuals({"pages": [{"page_no": 1, "visual_brief_ko": "충분히 구체적인 한국어 장면 설명을 길게 작성하여 검토가 가능하게 만든다.", "visual_prompt": "short prompt"}]}, 1)

    def test_visual_validator_does_not_treat_photograph_as_graph(self) -> None:
        prompt = " ".join([
            "A premium editorial photograph shows a concrete bridge carrying steady traffic through a wide valley.",
            "The camera uses a distant elevated view and a 50mm lens with natural daylight and restrained color grading.",
            "Detailed asphalt fills the foreground, bridge columns occupy the midground, and wooded hills remain in the background.",
            "The infrastructure stays the sole subject while distant vehicles provide realistic operational scale without visible occupants.",
            "Soft overcast light preserves believable materials, modest contrast, and calm gray and olive tones throughout the single documentary scene.",
            "Keep the lower 35 percent naturally darker through roadway shadow for a quiet text-safe area without an empty black slab.",
            "Maintain physically plausible dimensions, natural surface detail, and consistent editorial realism across the complete frame. No readable text, numbers, logos, signage or watermark."
        ])
        validate_visuals({"pages": [{"page_no": 1, "visual_brief_ko": "넓은 계곡의 교량과 일정한 차량 흐름을 한 장면에 담아 장기 운영 현금흐름을 보여준다.", "visual_prompt": prompt}]}, 1)

    @patch("run_local_pipeline.post_json")
    def test_ollama_uses_small_batch_for_legacy_vulkan_driver(self, post_json) -> None:
        post_json.return_value = {"message": {"content": '{"ok": true}'}}
        client = OllamaClient("http://127.0.0.1:11434", "qwen3:4b-instruct", 8192, 30)
        client.generate([{"role": "user", "content": "test"}], {"type": "object"}, 0.1, 100)
        payload = post_json.call_args.args[1]
        self.assertEqual(256, payload["options"]["num_batch"])

    def test_prompt_source_rewrites_forbidden_metaphors(self) -> None:
        source = {"meta": {}, "lead": "포트폴리오의 온도를 낮춰주는 자산", "sections": []}
        self.assertNotIn("온도", compact_source(source)["lead"])

    def test_copy_schema_does_not_force_mid_sentence_truncation(self) -> None:
        rules = {"limits": {"cover_title_max_chars": 36}, "structure": {"body_pages_preferred": 4}}
        schema = copy_schema(rules)
        self.assertNotIn("maxLength", schema["properties"]["cover"]["properties"]["title"])

    @patch("run_local_pipeline.post_json")
    def test_opencodex_uses_json_schema(self, post_json) -> None:
        post_json.return_value = {"choices": [{"message": {"content": '{"ok": true}'}}]}
        client = OpenCodexClient("http://127.0.0.1:10100/v1", "gpt-5.6-luna", 30)
        client.generate([{"role": "user", "content": "test"}], {"type": "object"}, 0.1, 100)
        payload = post_json.call_args.args[1]
        self.assertEqual("json_schema", payload["response_format"]["type"])

    def test_valid_checkpoint_is_resumed(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "copy-03.json"
            path.write_text('{"ok": true}', encoding="utf-8")
            checkpoint = load_valid_checkpoint(Path(directory), "copy", lambda value: None if value["ok"] else (_ for _ in ()).throw(ValueError()))
            self.assertEqual(3, checkpoint[1])


if __name__ == "__main__":
    unittest.main()
