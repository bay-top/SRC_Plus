#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import boto3


def client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def upload(local: Path, key: str, content_type: str | None = None) -> None:
    extra = {"ContentType": content_type} if content_type else None
    kwargs = {"ExtraArgs": extra} if extra else {}
    client().upload_file(str(local), os.environ["R2_BUCKET"], key, **kwargs)
    print(f"uploaded {local} -> {key}")


def download(key: str, local: Path) -> None:
    local.parent.mkdir(parents=True, exist_ok=True)
    client().download_file(os.environ["R2_BUCKET"], key, str(local))
    print(f"downloaded {key} -> {local}")


def download_manifest_assets(manifest_path: Path, output_dir: Path) -> None:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    for page in manifest["pages"]:
        target = output_dir / f"page-{int(page['page_no']):02d}.png"
        download(page["image_key"], target)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    up = sub.add_parser("upload")
    up.add_argument("local", type=Path)
    up.add_argument("key")
    up.add_argument("--content-type")
    down = sub.add_parser("download")
    down.add_argument("key")
    down.add_argument("local", type=Path)
    assets = sub.add_parser("download-manifest-assets")
    assets.add_argument("manifest", type=Path)
    assets.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    if args.command == "upload":
        upload(args.local, args.key, args.content_type)
    elif args.command == "download":
        download(args.key, args.local)
    else:
        download_manifest_assets(args.manifest, args.output_dir)


if __name__ == "__main__":
    main()
