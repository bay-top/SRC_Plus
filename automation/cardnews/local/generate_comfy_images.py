from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


def request_json(url: str, payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method="POST" if payload is not None else "GET",
    )
    if payload is not None:
        request.add_header("content-type", "application/json")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def workflow(prompt: str, negative: str, checkpoint: str, seed: int, width: int, height: int, steps: int, cfg: float) -> dict[str, Any]:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": checkpoint}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0, "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": "srcplus", "images": ["6", 0]}},
    }


def submit(base_url: str, graph: dict[str, Any], client_id: str) -> str:
    result = request_json(f"{base_url.rstrip('/')}/prompt", {"prompt": graph, "client_id": client_id})
    if result.get("error"):
        raise RuntimeError(f"ComfyUI workflow error: {result['error']}")
    if not result.get("prompt_id"):
        raise RuntimeError(f"ComfyUI did not return prompt_id: {result}")
    return str(result["prompt_id"])


def wait_for_image(base_url: str, prompt_id: str, timeout: int) -> tuple[str, str, str]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        history = request_json(f"{base_url.rstrip('/')}/history/{urllib.parse.quote(prompt_id)}", timeout=30)
        item = history.get(prompt_id)
        if item and item.get("status", {}).get("status_str") == "error":
            raise RuntimeError(f"ComfyUI generation failed: {item.get('status')}")
        if item and item.get("outputs"):
            for node in item["outputs"].values():
                for image in node.get("images", []):
                    return str(image.get("filename", "")), str(image.get("subfolder", "")), str(image.get("type", "output"))
        time.sleep(2)
    raise TimeoutError(f"ComfyUI generation timed out after {timeout}s: {prompt_id}")


def download_image(base_url: str, filename: str, subfolder: str, image_type: str) -> bytes:
    query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": image_type})
    with urllib.request.urlopen(f"{base_url.rstrip('/')}/view?{query}", timeout=60) as response:
        data = response.read()
    if len(data) < 10_000:
        raise RuntimeError("ComfyUI returned an unexpectedly small image.")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate sequential A/B SRC Plus images through ComfyUI API.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:8188")
    parser.add_argument("--checkpoint", default="Realistic_Vision_V6.0_NV_B1_fp16.safetensors")
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=704)
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--cfg", type=float, default=5.0)
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    pages = [page for page in manifest.get("pages", []) if page.get("page_kind") != "cta"]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    negative = "illustration, drawing, anime, cartoon, painting, watercolor, vector art, CGI, 3D render, text, letters, numbers, logo, signage, watermark, distorted architecture, duplicate objects, face close-up, headshot, oversaturated, neon, fantasy"
    client_id = f"srcplus-{int(time.time())}"
    generated: list[dict[str, Any]] = []

    for page in pages:
        for variant, seed_offset in (("a", 17), ("b", 43)):
            page_no = int(page["page_no"])
            filename = output_dir / f"page-{page_no:02d}-{variant}.png"
            if filename.exists() and filename.stat().st_size > 10_000:
                generated.append({"page_no": page_no, "variant": variant, "path": str(filename), "reused": True})
                continue
            prompt = str(page["visual_prompt"]) + " RAW editorial photograph, physically plausible materials, no post-production text."
            graph = workflow(prompt, negative, args.checkpoint, page_no * 100003 + seed_offset, args.width, args.height, args.steps, args.cfg)
            prompt_id = submit(args.base_url, graph, client_id)
            source_name, subfolder, image_type = wait_for_image(args.base_url, prompt_id, args.timeout)
            filename.write_bytes(download_image(args.base_url, source_name, subfolder, image_type))
            generated.append({"page_no": page_no, "variant": variant, "path": str(filename), "prompt_id": prompt_id, "width": args.width, "height": args.height})
            print(f"생성 완료: page {page_no} {variant}", flush=True)

    result = {"manifest": str(Path(args.manifest).resolve()), "checkpoint": args.checkpoint, "width": args.width, "height": args.height, "images": generated}
    (output_dir / "generated-images.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"전체 이미지 생성 완료: {len(generated)}개")


if __name__ == "__main__":
    main()
