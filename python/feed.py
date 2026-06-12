#!/usr/bin/env python3
"""PawNode — trigger one Petlibro manual feed (MVP).

API reference: https://github.com/jjjonesjr33/petlibro
Source: custom_components/petlibro/api.py (dev branch)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import uuid

import requests

APP_ID = 1
APP_SN = "c35772530d1041699c87fe62348507a8"
API_URLS = {"US": "https://api.us.petlibro.com"}


def hash_password(password: str) -> str:
    return hashlib.md5(password.encode("utf-8")).hexdigest()


def api_headers(token: str | None, timezone: str) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "source": "ANDROID",
        "language": "EN",
        "timezone": timezone,
        "version": "1.3.45",
    }
    if token:
        headers["token"] = token
    return headers


def login(base_url: str, email: str, password: str, region: str, timezone: str) -> str:
    payload = {
        "appId": APP_ID,
        "appSn": APP_SN,
        "country": region,
        "email": email,
        "password": hash_password(password),
        "phoneBrand": "",
        "phoneSystemVersion": "",
        "timezone": timezone,
        "thirdId": None,
        "type": None,
    }
    response = requests.post(
        f"{base_url}/member/auth/login",
        json=payload,
        headers=api_headers(None, timezone),
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    token = data.get("token")
    if not token:
        raise RuntimeError(f"login_failed: {data}")
    return token


def list_devices(base_url: str, token: str, timezone: str) -> list[dict]:
    response = requests.post(
        f"{base_url}/device/device/list",
        json={},
        headers=api_headers(token, timezone),
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    if isinstance(data, dict) and "data" in data:
        return data["data"] or []
    if isinstance(data, list):
        return data
    return []


def pick_feeder(devices: list[dict], device_sn: str | None) -> dict:
    if device_sn:
        for device in devices:
            sn = device.get("deviceSn") or device.get("id")
            if sn == device_sn:
                return device
        raise RuntimeError(f"device_not_found: {device_sn}")

    feeders = [
        d
        for d in devices
        if str(d.get("productIdentifier", "")).startswith("PLAF")
        or "feeder" in str(d.get("productName", "")).lower()
    ]
    if not feeders and devices:
        feeders = devices
    if not feeders:
        raise RuntimeError("no_devices_found")
    return feeders[0]


def manual_feed(base_url: str, token: str, timezone: str, serial: str, grain_num: int) -> dict:
    payload = {
        "deviceSn": serial,
        "grainNum": int(grain_num),
        "requestId": uuid.uuid4().hex,
    }
    response = requests.post(
        f"{base_url}/device/device/manualFeeding",
        json=payload,
        headers=api_headers(token, timezone),
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    if isinstance(data, dict) and data.get("code") not in (0, None):
        raise RuntimeError(data.get("msg") or f"feed_failed: {data}")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="PawNode Petlibro feed")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--region", default="US")
    parser.add_argument("--timezone", default="Asia/Seoul")
    parser.add_argument("--device-sn", default="")
    parser.add_argument("--grain-num", type=int, default=1)
    args = parser.parse_args()

    base_url = API_URLS.get(args.region.upper())
    if not base_url:
        print(json.dumps({"success": False, "message": f"unsupported_region: {args.region}"}))
        return 1

    try:
        token = login(base_url, args.email, args.password, args.region.upper(), args.timezone)
        devices = list_devices(base_url, token, args.timezone)
        feeder = pick_feeder(devices, args.device_sn or None)
        serial = feeder.get("deviceSn") or feeder.get("id")
        if not serial:
            raise RuntimeError("missing_device_serial")

        raw = manual_feed(base_url, token, args.timezone, serial, args.grain_num)
        print(
            json.dumps(
                {
                    "success": True,
                    "message": "feed_ok",
                    "device_sn": serial,
                    "device_name": feeder.get("name"),
                    "grain_num": args.grain_num,
                    "raw": raw,
                }
            )
        )
        return 0
    except Exception as exc:  # noqa: BLE001 — MVP CLI exits with JSON error
        print(json.dumps({"success": False, "message": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
