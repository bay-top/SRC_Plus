#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup, Tag

META_PATTERN = re.compile(r'<script[^>]+id=["\']report-meta["\'][^>]*>(.*?)</script>', re.I | re.S)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_meta(html: str) -> dict[str, Any]:
    match = META_PATTERN.search(html)
    if not match:
        raise ValueError("report-meta 블록이 없습니다.")
    meta = json.loads(match.group(1).strip())
    required = {"title", "topic", "cat", "date", "author", "published"}
    missing = sorted(required - set(meta))
    if missing:
        raise ValueError(f"report-meta 필수 필드 누락: {', '.join(missing)}")
    return meta


def table_data(table: Tag) -> dict[str, Any]:
    rows: list[list[str]] = []
    for tr in table.find_all("tr"):
        cells = [clean_text(cell.get_text(" ", strip=True)) for cell in tr.find_all(["th", "td"])]
        if any(cells):
            rows.append(cells)
    return {"type": "table", "rows": rows, "text": "\n".join(" | ".join(row) for row in rows)}


def block_data(node: Tag) -> dict[str, Any] | None:
    classes = set(node.get("class", []))
    if node.name == "table":
        return table_data(node)
    if "callout" in classes:
        label = node.find(class_="callout-label")
        return {
            "type": "disclaimer" if "disclaimer" in classes else "callout",
            "label": clean_text(label.get_text(" ", strip=True)) if label else "",
            "text": clean_text(node.get_text(" ", strip=True)),
        }
    if "formula" in classes:
        return {"type": "formula", "text": clean_text(node.get_text(" ", strip=True))}
    if node.name == "blockquote":
        return {"type": "blockquote", "text": clean_text(node.get_text(" ", strip=True))}
    if node.name in {"p", "li"}:
        text = clean_text(node.get_text(" ", strip=True))
        if len(text) >= 5:
            return {"type": "lead" if "lead" in classes else "text", "text": text}
    return None


def section_priority(heading: str, blocks: list[dict[str, Any]]) -> int:
    score = 1
    lower = heading.lower()
    if any(term in heading for term in ["핵심", "결론", "투자 포인트", "판단", "쟁점"]):
        score += 4
    if any(block["type"] == "callout" for block in blocks):
        score += 3
    if any(block["type"] in {"table", "formula", "blockquote"} for block in blocks):
        score += 2
    if any(term in lower for term in ["faq", "용어", "glossary", "disclaimer"]):
        score -= 4
    return score


def parse_html(path: Path) -> dict[str, Any]:
    html = path.read_text(encoding="utf-8", errors="replace")
    meta = parse_meta(html)
    soup = BeautifulSoup(html, "lxml")
    article = soup.select_one("article.article") or soup.body or soup
    for node in article.select("script, style, noscript, svg, nav, footer, .topbar, .a-eyebrow, .a-meta"):
        node.decompose()

    lead_node = article.select_one("p.lead")
    lead = clean_text(lead_node.get_text(" ", strip=True)) if lead_node else ""

    sections: list[dict[str, Any]] = []
    current_heading = meta["title"]
    current_level = 1
    current_blocks: list[dict[str, Any]] = []
    seen: set[str] = set()

    def flush() -> None:
        nonlocal current_blocks
        if not current_blocks:
            return
        sections.append({
            "heading": current_heading,
            "level": current_level,
            "blocks": current_blocks,
            "priority": section_priority(current_heading, current_blocks),
        })
        current_blocks = []

    for node in article.find_all(["h2", "h3", "p", "li", "blockquote", "table", "div"], recursive=True):
        if node.name in {"h2", "h3"}:
            flush()
            current_heading = clean_text(node.get_text(" ", strip=True)) or "섹션"
            current_level = int(node.name[1])
            continue
        if node.name == "div" and not (set(node.get("class", [])) & {"callout", "formula"}):
            continue
        if node.find_parent(["table", "blockquote", "div"], class_=["callout", "formula"]):
            continue
        block = block_data(node)
        if not block:
            continue
        key = f"{block['type']}:{block.get('text', '')}"
        if key in seen:
            continue
        seen.add(key)
        current_blocks.append(block)
    flush()

    budget = 42000
    used = len(lead)
    compact: list[dict[str, Any]] = []
    for section in sections:
        blocks: list[dict[str, Any]] = []
        for block in section["blocks"]:
            cost = len(json.dumps(block, ensure_ascii=False))
            if used + cost > budget:
                break
            blocks.append(block)
            used += cost
        if blocks:
            compact.append({**section, "blocks": blocks})
        if used >= budget:
            break

    return {
        "source_file": path.as_posix(),
        "meta": meta,
        "lead": lead,
        "sections": compact,
        "character_count": used,
        "cardnews_rules": {
            "language": "한국어 중심",
            "tone": "~이다/~한다 단문 서술체",
            "structure": "표지 1장 + 본문 3~5장 + 고정 안내 1장",
            "selection": "전체 요약이 아니라 핵심 구조·수치·판단 포인트 선별",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not args.input.exists():
        raise SystemExit(f"Input file not found: {args.input}")
    result = parse_html(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {args.input} -> {args.output} ({result['character_count']} chars)")


if __name__ == "__main__":
    main()
