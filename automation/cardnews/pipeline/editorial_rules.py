from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def load_editorial_rules(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def comparable(value: str) -> str:
    return re.sub(r"[^0-9a-z가-힣]", "", value.lower())


def sentence_count(value: str) -> int:
    return len(re.findall(r"[.!?](?=(?:[\"'”’\)\]]*\s)|$)", value.strip()))


def sentences(value: str) -> list[str]:
    return [comparable(part) for part in re.split(r"(?<=[.!?])(?:[\"'”’\)\]]*)\s+", value.strip()) if len(comparable(part)) >= 20]


def validate_manifest(manifest: dict[str, Any], rules: dict[str, Any]) -> None:
    pages = manifest.get("pages")
    if not isinstance(pages, list):
        raise ValueError("렌더 manifest에 pages 배열이 없습니다.")

    structure = rules["structure"]
    limits = rules["limits"]
    covers = [page for page in pages if page.get("page_kind") == "cover"]
    bodies = [page for page in pages if page.get("page_kind") == "body"]
    ctas = [page for page in pages if page.get("page_kind") == "cta"]
    errors: list[str] = []

    if len(covers) != structure["cover_pages"]:
        errors.append(f"표지는 {structure['cover_pages']}장이어야 합니다.")
    if not structure["body_pages_min"] <= len(bodies) <= structure["body_pages_max"]:
        errors.append(f"본문은 {structure['body_pages_min']}~{structure['body_pages_max']}장이어야 합니다.")
    if len(ctas) != structure["cta_pages"]:
        errors.append(f"CTA는 {structure['cta_pages']}장이어야 합니다.")

    if covers:
        title = str(covers[0].get("title", "")).strip()
        subtitle = str(covers[0].get("body", "")).strip()
        if len(title) > limits["cover_title_max_chars"]:
            errors.append("표지 제목 글자 수가 중앙 기준을 초과했습니다.")
        if not limits["cover_subtitle_min_chars"] <= len(subtitle) <= limits["cover_subtitle_max_chars"]:
            errors.append("표지 부제 글자 수가 중앙 기준을 벗어났습니다.")
        if comparable(title) == comparable(subtitle):
            errors.append("표지 제목과 부제가 중복됐습니다.")

    seen_titles: set[str] = set()
    seen_sentences: set[str] = set()
    cover_title = comparable(str(covers[0].get("title", ""))) if covers else ""
    for index, page in enumerate(bodies, start=1):
        title = str(page.get("title", "")).strip()
        body = str(page.get("body", "")).strip()
        normalized_title = comparable(title)
        if not limits["body_title_min_chars"] <= len(title) <= limits["body_title_max_chars"]:
            errors.append(f"본문 {index} 제목 글자 수가 중앙 기준을 벗어났습니다.")
        if not limits["body_min_chars"] <= len(body) <= limits["body_max_chars"]:
            errors.append(f"본문 {index} 글자 수가 중앙 기준을 벗어났습니다.")
        count = sentence_count(body)
        if not limits["body_sentences_min"] <= count <= limits["body_sentences_max"]:
            errors.append(f"본문 {index} 문장 수({count})가 중앙 기준을 벗어났습니다.")
        if normalized_title in seen_titles or normalized_title == cover_title:
            errors.append(f"본문 {index} 제목이 다른 페이지와 중복됐습니다.")
        if normalized_title == comparable(body):
            errors.append(f"본문 {index} 제목과 내용이 중복됐습니다.")
        if comparable(body).startswith(normalized_title):
            errors.append(f"본문 {index}이 제목을 첫 문장에서 반복했습니다.")
        for sentence in sentences(body):
            if sentence in seen_sentences:
                errors.append(f"본문 {index}이 앞 페이지 문장을 반복했습니다.")
            seen_sentences.add(sentence)
        seen_titles.add(normalized_title)

    if ctas and len(str(ctas[0].get("title", "")).strip()) > limits["cta_subject_max_chars"]:
        errors.append("CTA 주제 글자 수가 중앙 기준을 초과했습니다.")
    if errors:
        raise ValueError("카드뉴스 편집 기준 위반:\n- " + "\n- ".join(errors))
