from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


CARDNEWS_DIR = Path(__file__).resolve().parents[1]
PIPELINE_DIR = CARDNEWS_DIR / "pipeline"
sys.path.insert(0, str(PIPELINE_DIR))

from editorial_rules import load_editorial_rules, validate_manifest  # noqa: E402
from parse_report import parse_html  # noqa: E402


def post_json(url: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama HTTP {error.code}: {detail[:500]}") from error


def compact_source(source: dict[str, Any], limit: int = 9000) -> dict[str, Any]:
    compact: dict[str, Any] = {
        "meta": source.get("meta", {}),
        "lead": source.get("lead", ""),
        "sections": [],
    }
    sections = sorted(source.get("sections", []), key=lambda item: item.get("priority", 0), reverse=True)
    for section in sections:
        candidate = {**compact, "sections": [*compact["sections"], section]}
        if len(json.dumps(candidate, ensure_ascii=False)) > limit:
            continue
        compact["sections"].append(section)
    replacements = {
        "포트폴리오의 온도를 낮춰주는": "포트폴리오 전체 변동성을 낮추는",
        "포트폴리오의 온도를 낮춰주는 자산": "포트폴리오 변동성을 보완하는 자산",
        "주식과 인프라는 다른 게임을 한다": "주식과 인프라는 수익 구조가 다르다",
        "변동성 완충재": "변동성 보완 수단",
        "성장 엔진": "성장 자산",
        "현금흐름이라는 본질": "현금흐름 특성",
    }

    def replace_metaphors(value: Any) -> Any:
        if isinstance(value, str):
            for old, new in replacements.items():
                value = value.replace(old, new)
            return value
        if isinstance(value, list):
            return [replace_metaphors(item) for item in value]
        if isinstance(value, dict):
            return {key: replace_metaphors(item) for key, item in value.items()}
        return value

    return replace_metaphors(compact)


def copy_schema(rules: dict[str, Any]) -> dict[str, Any]:
    limits = rules["limits"]
    preferred = rules["structure"]["body_pages_preferred"]
    return {
        "type": "object",
        "properties": {
            "report_title": {"type": "string"},
            "category": {"type": "string", "enum": ["insights", "issues", "sectors"]},
            "cover": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "subtitle": {"type": "string"},
                },
                "required": ["title", "subtitle"],
            },
            "body_pages": {
                "type": "array",
                "minItems": preferred,
                "maxItems": preferred,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "body": {"type": "string"},
                    },
                    "required": ["title", "body"],
                },
            },
            "cta_subject": {"type": "string"},
        },
        "required": ["report_title", "category", "cover", "body_pages", "cta_subject"],
    }


def visual_schema(page_count: int) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "pages": {
                "type": "array",
                "minItems": page_count,
                "maxItems": page_count,
                "items": {
                    "type": "object",
                    "properties": {
                        "page_no": {"type": "integer"},
                        "visual_style": {"type": "string", "enum": ["photo", "illustration"]},
                        "visual_brief_ko": {"type": "string", "minLength": 35},
                        "visual_prompt": {"type": "string", "minLength": 500},
                    },
                    "required": ["page_no", "visual_style", "visual_brief_ko", "visual_prompt"],
                },
            }
        },
        "required": ["pages"],
    }


class OllamaClient:
    def __init__(self, base_url: str, model: str, context_tokens: int, timeout: int) -> None:
        self.url = f"{base_url.rstrip('/')}/api/chat"
        self.model = model
        self.context_tokens = context_tokens
        self.timeout = timeout

    def generate(self, messages: list[dict[str, str]], schema: dict[str, Any], temperature: float, max_tokens: int) -> dict[str, Any]:
        payload = post_json(
            self.url,
            {
                "model": self.model,
                "messages": messages,
                "format": schema,
                "stream": False,
                "think": False,
                "options": {
                    "temperature": temperature,
                    "num_ctx": self.context_tokens,
                    "num_batch": 256,
                    "num_predict": max_tokens,
                },
                "keep_alive": "10m",
            },
            self.timeout,
        )
        content = payload.get("message", {}).get("content")
        if not content:
            raise RuntimeError("Ollama가 응답 본문을 반환하지 않았습니다.")
        return json.loads(content)


class OpenCodexClient:
    def __init__(self, base_url: str, model: str, timeout: int) -> None:
        self.url = f"{base_url.rstrip('/')}/chat/completions"
        self.model = model
        self.timeout = timeout

    def generate(self, messages: list[dict[str, str]], schema: dict[str, Any], temperature: float, max_tokens: int) -> dict[str, Any]:
        payload = post_json(
            self.url,
            {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": "srcplus_cardnews", "strict": False, "schema": schema},
                },
            },
            self.timeout,
        )
        content = payload.get("choices", [{}])[0].get("message", {}).get("content")
        if not content:
            raise RuntimeError("OpenCodex가 응답 본문을 반환하지 않았습니다.")
        return json.loads(content)


def copy_manifest(copy: dict[str, Any]) -> dict[str, Any]:
    pages = [{"page_no": 1, "page_kind": "cover", "title": copy["cover"]["title"], "body": copy["cover"]["subtitle"]}]
    pages.extend(
        {"page_no": index + 2, "page_kind": "body", "title": page["title"], "body": page["body"]}
        for index, page in enumerate(copy["body_pages"])
    )
    pages.append({"page_no": len(pages) + 1, "page_kind": "cta", "title": copy["cta_subject"], "body": "고정 안내 문구"})
    return {"pages": pages}


def validate_visuals(result: dict[str, Any], page_count: int) -> None:
    pages = result.get("pages")
    if not isinstance(pages, list) or len(pages) != page_count:
        raise ValueError(f"이미지 계획은 정확히 {page_count}개여야 합니다.")
    seen: set[int] = set()
    forbidden = re.compile(
        r"split[- ]screen|\binfographic\b|\bcollage\b|\bmontage\b|\bchart\b|\bgraph\b|\bsketch\b|\bdrawing\b|\billustration\b|\banime\b|\banimation\b|\bcartoon\b|\bpainting\b|\bwatercolor\b|\bvector art\b|\b3d render\b|\bcgi\b|\bheadshot\b|face[- ]led|close[- ]up portrait",
        re.I,
    )
    for page in pages:
        page_no = int(page.get("page_no", 0))
        prompt = str(page.get("visual_prompt", "")).strip()
        brief = str(page.get("visual_brief_ko", "")).strip()
        if page_no < 1 or page_no > page_count or page_no in seen:
            raise ValueError("이미지 계획의 page_no가 누락되거나 중복됐습니다.")
        seen.add(page_no)
        if len(brief) < 35 or not re.search(r"[가-힣]", brief):
            raise ValueError(f"{page_no}페이지 한국어 이미지 설명이 너무 짧습니다.")
        words = prompt.split()
        if len(words) < 110 or len(words) > 150:
            raise ValueError(f"{page_no}페이지 이미지 프롬프트는 110~150개 영어 단어여야 합니다. 현재 {len(words)}개입니다.")
        if re.search(r"[가-힣]", prompt) or forbidden.search(prompt):
            raise ValueError(f"{page_no}페이지 이미지 프롬프트에 금지된 언어·표현이 있습니다.")
        required = [r"(?:camera|shoot|shot|view|angle)", r"lens", r"(?:light|daylight|dusk|dawn|overcast)", r"lower (?:3[0-9]|40|thirty|thirty-five|forty)", r"no readable text", r"(?:no readable text[^.]{0,60}\blogos?\b|no (?:company )?logos?)"]
        if any(not re.search(pattern, prompt, re.I) for pattern in required):
            raise ValueError(f"{page_no}페이지 이미지 프롬프트에 필수 촬영 지시가 빠졌습니다.")


def retry_generation(
    client: Any,
    base_messages: list[dict[str, str]],
    schema: dict[str, Any],
    validator: Any,
    max_attempts: int,
    max_tokens: int,
    stage: str,
    attempt_dir: Path,
) -> tuple[dict[str, Any], int]:
    previous: dict[str, Any] | None = None
    error_text = ""
    for attempt in range(1, max_attempts + 1):
        messages = list(base_messages)
        if previous is not None:
            messages.append({
                "role": "user",
                "content": f"이전 결과는 검증에 실패했다. 오류: {error_text}\n이전 JSON: {json.dumps(previous, ensure_ascii=False)}\n"
                "오류가 지목한 필드를 사실 중심 문장으로 표적 수정하라. 'X가 아니라 Y', '핵심은', '단순히 ~를 넘어', '온도', '완충재', '성장 엔진', '다른 게임', '본질' 같은 표현을 제거한다. "
                "문장을 글자 수에 맞추려고 중간에서 자르지 말고 완결된 문장으로 다시 쓴다. 나머지 사실과 페이지 역할은 유지한 전체 JSON만 출력하라.",
            })
        candidate = client.generate(messages, schema, 0.2 if attempt == 1 else 0.1, max_tokens)
        attempt_dir.mkdir(parents=True, exist_ok=True)
        attempt_path = attempt_dir / f"{stage}-{attempt:02d}.json"
        attempt_path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            validator(candidate)
            print(f"{stage}: {attempt}회에 중앙 규칙 통과", flush=True)
            return candidate, attempt
        except (KeyError, TypeError, ValueError) as error:
            previous = candidate
            error_text = str(error)
            print(f"{stage}: {attempt}회 검증 실패 - {error_text.splitlines()[-1]}", flush=True)
    raise RuntimeError(f"{max_attempts}회 교정 후에도 중앙 규칙을 통과하지 못했습니다: {error_text}")


def load_valid_checkpoint(attempt_dir: Path, stage: str, validator: Any) -> tuple[dict[str, Any], int] | None:
    for path in sorted(attempt_dir.glob(f"{stage}-*.json"), reverse=True):
        try:
            candidate = json.loads(path.read_text(encoding="utf-8"))
            validator(candidate)
            attempt = int(path.stem.rsplit("-", 1)[-1])
            print(f"{stage}: 검증된 checkpoint {path.name} 재사용", flush=True)
            return candidate, attempt
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            continue
    return None


def run(args: argparse.Namespace) -> dict[str, Any]:
    rules_path = Path(args.editorial)
    rules = load_editorial_rules(rules_path)
    source = parse_html(Path(args.input), rules_path)
    source_for_prompt = compact_source(source)
    client = (
        OpenCodexClient(args.opencodex_url, args.model, args.timeout)
        if args.provider == "opencodex"
        else OllamaClient(args.ollama_url, args.model, args.context_tokens, args.timeout)
    )
    attempt_dir = Path(args.attempt_dir) if args.attempt_dir else Path(args.output).with_suffix("").parent / "attempts" / Path(args.output).stem

    copy_system = (
        "SRC Plus의 한국어 인스타그램 카드뉴스 편집자다. 이미지 계획은 쓰지 않는다. "
        "원문에 없는 사실과 수치를 만들지 않고 중앙 규칙을 모두 적용한다. JSON 외에는 출력하지 않는다.\n"
        + json.dumps({key: rules[key] for key in ["tone", "anti_ai_style", "structure", "planning", "limits", "page_roles", "quality_rules"]}, ensure_ascii=False)
    )
    copy_user = (
        "구조화된 리포트를 표지 1장, 본문 4장, CTA 주제 하나로 편집하라. 참고 제목이나 원문 문장을 복사하지 말고 사실·수치·인과관계만 재서술한다. "
        "본문은 각 1~3개의 완결된 문장이고 중간에서 자르지 않는다. CTA 주제는 문장이 아닌 짧은 명사구다.\n"
        + json.dumps(source_for_prompt, ensure_ascii=False)
    )
    copy_validator = lambda value: validate_manifest(copy_manifest(value), rules)
    copy_checkpoint = load_valid_checkpoint(attempt_dir, "copy", copy_validator)
    copy, copy_attempts = copy_checkpoint or retry_generation(
        client,
        [{"role": "system", "content": copy_system}, {"role": "user", "content": copy_user}],
        copy_schema(rules),
        copy_validator,
        args.max_attempts,
        2400,
        "copy",
        attempt_dir,
    )

    copy_pages = copy_manifest(copy)["pages"][:-1]
    visual_system = (
        "SRC Plus 카드뉴스 비주얼 디렉터다. 확정 문안은 바꾸지 않는다. 모든 페이지를 동일한 Getty Images풍 실제 경제지 사진 시리즈로 설계한다. "
        "JSON 외에는 출력하지 않는다.\n" + json.dumps(rules["visual_direction"], ensure_ascii=False)
    )
    visual_user = (
        "각 페이지의 주장과 원문 대목을 대조해 구체적인 자산·시설·장소·업무 행동 하나를 고른다. "
        "visual_brief_ko는 2~3개의 구체적인 한국어 문장, visual_prompt는 110~150개 영어 단어의 단일 촬영 장면이다. "
        "카메라 거리·각도·렌즈·시간·조명·색보정·전경/중경/배경·하단 30~40% 안전영역을 포함한다. "
        "마지막에 No readable text, numbers, logos, signage or watermark.를 쓴다.\n"
        f"원문: {json.dumps(source_for_prompt, ensure_ascii=False)}\n확정 문안: {json.dumps(copy_pages, ensure_ascii=False)}"
    )
    visual_validator = lambda value: validate_visuals(value, len(copy_pages))
    visual_checkpoint = load_valid_checkpoint(attempt_dir, "visual", visual_validator)
    visuals, visual_attempts = visual_checkpoint or retry_generation(
        client,
        [{"role": "system", "content": visual_system}, {"role": "user", "content": visual_user}],
        visual_schema(len(copy_pages)),
        visual_validator,
        args.max_attempts,
        3600,
        "visual",
        attempt_dir,
    )

    visual_by_page = {int(page["page_no"]): page for page in visuals["pages"]}
    for page in copy_pages:
        page.update(visual_by_page[int(page["page_no"])])
    output = {
        "source_file": str(Path(args.input).resolve()),
        "provider": args.provider,
        "model": args.model,
        "copy_attempts": copy_attempts,
        "visual_attempts": visual_attempts,
        "report_title": copy["report_title"],
        "category": copy["category"],
        "pages": [*copy_pages, copy_manifest(copy)["pages"][-1]],
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the SRC Plus copy and visual-prompt pipeline on local Ollama.")
    parser.add_argument("--input", required=True, help="Published reports_*.html file")
    parser.add_argument("--output", required=True, help="Output JSON path")
    parser.add_argument("--editorial", default=str(CARDNEWS_DIR / "config" / "editorial.json"))
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--opencodex-url", default="http://127.0.0.1:10100/v1")
    parser.add_argument("--provider", choices=["ollama", "opencodex"], default="ollama")
    parser.add_argument("--model", default="qwen3:4b-instruct", help="Use gpt-5.6-luna with --provider opencodex")
    parser.add_argument("--context-tokens", type=int, default=8192)
    parser.add_argument("--max-attempts", type=int, default=10)
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--attempt-dir", help="Directory for per-attempt JSON checkpoints")
    args = parser.parse_args()
    result = run(args)
    print(f"완료: {args.output} (문안 {result['copy_attempts']}회, 이미지 계획 {result['visual_attempts']}회)")


if __name__ == "__main__":
    main()
