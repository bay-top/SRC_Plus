#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

from parse_report import parse_meta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--event-id", required=True)
    args = parser.parse_args()

    meta = parse_meta(args.input.read_text(encoding="utf-8", errors="replace"))
    if not meta.get("published"):
        print(f"Skip unpublished report: {args.input}")
        return
    worker_url = os.environ["CARDNEWS_WORKER_BASE_URL"].rstrip("/") + "/api/report-published"
    secret = os.environ["CARDNEWS_CALLBACK_HMAC_SECRET"].encode("utf-8")
    body = json.dumps({"event_id": args.event_id, "source_path": args.input.as_posix()}, ensure_ascii=False).encode("utf-8")
    signature = hmac.new(secret, body, hashlib.sha256).hexdigest()
    request = Request(worker_url, data=body, method="POST", headers={"content-type": "application/json", "x-cardnews-signature": f"sha256={signature}"})
    with urlopen(request, timeout=30) as response:
        if response.status >= 300:
            raise SystemExit(f"Worker notification failed: {response.status}")
        print(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()
