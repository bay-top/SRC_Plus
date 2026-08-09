from __future__ import annotations

import unittest
from pathlib import Path

from editorial_rules import load_editorial_rules, validate_manifest


RULES_PATH = Path(__file__).parents[1] / "config" / "editorial.json"


def valid_manifest() -> dict:
    return {
        "pages": [
            {"page_no": 1, "page_kind": "cover", "title": "공간 전략의 기준이 바뀐다", "body": "비용을 넘어 운영 안정성을 함께 판단해야 한다"},
            {"page_no": 2, "page_kind": "body", "title": "기존 전략이 작동한 조건", "body": "낮은 조달 비용은 자산을 직접 보유할 유인을 낮추고 외부 공간을 활용하기 쉽게 만들었다. 기업은 확보한 자본을 본업의 성장과 운영 효율을 높이는 곳에 재투자하는 선택을 우선했다."},
            {"page_no": 3, "page_kind": "body", "title": "공급 제약이 만든 변화", "body": "필요한 공간을 원하는 시점에 임차할 수 있다는 기존 가정이 핵심 입지의 공급 부족으로 약해지고 있다. 대체 공간을 찾기 어려워지면 이전 비용뿐 아니라 운영 중단과 서비스 품질 저하의 위험도 커진다."},
            {"page_no": 4, "page_kind": "body", "title": "판단 기준은 사업 영향", "body": "소유와 임차는 단기 자산 가격이나 임대료만 비교해서 결정하기 어렵다. 해당 공간이 매출과 공급 안정성, 고객 경험에 미치는 영향을 함께 평가해야 사업에 맞는 선택을 할 수 있다."},
            {"page_no": 5, "page_kind": "cta", "title": "공간 전략을 결정하는 기준", "body": "고정 안내 문구"},
        ]
    }


class EditorialRulesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rules = load_editorial_rules(RULES_PATH)

    def test_accepts_copy_that_matches_central_rules(self) -> None:
        validate_manifest(valid_manifest(), self.rules)

    def test_rejects_cover_and_body_repetition(self) -> None:
        manifest = valid_manifest()
        manifest["pages"][1]["title"] = manifest["pages"][0]["title"]
        with self.assertRaisesRegex(ValueError, "중복"):
            validate_manifest(manifest, self.rules)

    def test_rejects_body_outside_sentence_limit(self) -> None:
        manifest = valid_manifest()
        manifest["pages"][1]["body"] = "첫 번째 주장이다. 두 번째 주장이다. 세 번째 주장이다. 한 페이지에 네 번째 주장까지 넣으면 중앙 편집 기준의 최대 문장 수를 초과하므로 독자가 한눈에 읽기 어렵다."
        with self.assertRaisesRegex(ValueError, "문장 수"):
            validate_manifest(manifest, self.rules)

    def test_rejects_repeated_sentence_across_pages(self) -> None:
        manifest = valid_manifest()
        manifest["pages"][2]["body"] = "낮은 조달 비용은 자산을 직접 보유할 유인을 낮추고 외부 공간을 활용하기 쉽게 만들었다. 핵심 입지의 공급 부족은 운영 중단 위험을 키우는 새로운 변수로 작용한다."
        with self.assertRaisesRegex(ValueError, "앞 페이지 문장"):
            validate_manifest(manifest, self.rules)

    def test_rejects_promotional_copy_in_body(self) -> None:
        manifest = valid_manifest()
        manifest["pages"][3]["body"] = "더 자세한 이야기와 다양한 주제의 리포트는 SRC Plus 페이지에서 확인할 수 있다. 모든 콘텐츠는 페이지에서 무료로 만나볼 수 있다."
        with self.assertRaisesRegex(ValueError, "홍보"):
            validate_manifest(manifest, self.rules)


if __name__ == "__main__":
    unittest.main()
