#!/usr/bin/env python3
"""Impor lokal read-only casefile; Python 3.10+, tanpa paket pihak ketiga."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile

SHEET = "pengelolaan casefile"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
CATEGORIES = {
    "H": ("kl", "K/L", 103), "I": ("lkd-provinsi", "LKD Prov", 35),
    "J": ("lkd-kabupaten", "LKD Kab", 365), "K": ("lkd-kota", "LKD Kota", 92),
    "L": ("ptn", "PTN", 35), "M": ("ptkn", "PTKN", 3),
    "N": ("pts", "PTS", 5), "O": ("ptk", "PTK", 2), "P": ("bumn", "BUMN", 3),
}
SELECTED = {"C", "D", "E", *CATEGORIES}


def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def local_id(code: str | None, name: str) -> str:
    # Tidak bergantung urutan baris, kategori, tahun atau nama file.
    return "casefile-" + digest([normalize(code or ""), normalize(name)])[:24]


def text_value(cell: dict | None) -> str:
    if cell is None:
        return ""
    value = cell["value"]
    if cell["type"] == "n" and value:
        try:
            number = Decimal(value)
            if number.is_finite() and number == number.to_integral_value():
                return str(int(number))
        except InvalidOperation:
            pass
    return value.strip()


def read_selected(workbook: Path) -> list[dict]:
    """Baca XML OOXML tanpa mengonversi kode berformat tanggal menjadi tanggal/error."""
    with ZipFile(workbook) as archive:
        root = ET.fromstring(archive.read("xl/workbook.xml"))
        sheet = next((s for s in root.findall("s:sheets/s:sheet", NS)
                      if s.attrib["name"] == SHEET), None)
        if sheet is None:
            raise ValueError(f"Sheet persis '{SHEET}' tidak ditemukan; tidak memilih sheet lain.")
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next((r.attrib["Target"] for r in relationships
                       if r.attrib.get("Id") == sheet.attrib[RID]), None)
        if not target:
            raise ValueError("Relasi XML sheet tidak ditemukan.")
        target = target.lstrip("/") if target.startswith("/") else str(PurePosixPath("xl") / target)
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(t.text or "" for t in s.iter("{" + NS["s"] + "}t")) for s in
                       ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        custom_formats, formats = {}, []
        if "xl/styles.xml" in archive.namelist():
            styles = ET.fromstring(archive.read("xl/styles.xml"))
            custom_formats = {s.attrib["numFmtId"]: s.attrib["formatCode"]
                              for s in styles.findall("s:numFmts/s:numFmt", NS)}
            formats = [s.attrib.get("numFmtId", "0") for s in styles.findall("s:cellXfs/s:xf", NS)]
        rows = []
        for row in ET.fromstring(archive.read(target)).findall("s:sheetData/s:row", NS):
            cells = {}
            for cell in row:
                column = re.sub(r"\d", "", cell.attrib.get("r", ""))
                if column not in SELECTED:
                    continue
                kind = cell.attrib.get("t", "n")
                value = cell.findtext("s:v", default="", namespaces=NS)
                if kind == "s":
                    value = strings[int(value)] if value else ""
                elif kind == "inlineStr":
                    value = "".join(t.text or "" for t in cell.find("s:is", NS).iter("{" + NS["s"] + "}t"))
                style = int(cell.attrib.get("s", "0"))
                format_id = formats[style] if style < len(formats) else "0"
                cells[column] = {"value": value, "type": kind, "numberFormatId": format_id,
                                 "numberFormat": custom_formats.get(format_id),
                                 "hasFormula": cell.find("s:f", NS) is not None}
            rows.append({"row": int(row.attrib["r"]), "cells": cells})
        return rows


def region_name(value: str) -> str:
    value = normalize(value)
    value = re.sub(r"\b(prov\.?|propinsi)\s+", "provinsi ", value)
    value = re.sub(r"\bkab\.?\s+", "kabupaten ", value)
    return value.strip(" .,;")


def validate_references(refs: dict) -> None:
    provinces = {p["id"] for p in refs["provinces"]}
    if len(provinces) != len(refs["provinces"]):
        raise ValueError("ID provinsi duplikat pada referensi.")
    kab_ids = [k["id"] for k in refs["kabKota"]]
    if len(set(kab_ids)) != len(kab_ids):
        raise ValueError("ID kabupaten/kota duplikat pada referensi.")
    if any(k["provinceId"] not in provinces for k in refs["kabKota"]):
        raise ValueError("Kabupaten/kota tidak memiliki provinsi induk yang sah.")


def match_region(name: str, category: str, refs: dict) -> dict:
    result = {"provinceId": None, "kabKotaId": None, "provinceName": None, "kabKotaName": None,
              "locationVerificationStatus": "unresolved",
              "locationVerificationNotes": "Lokasi tidak ditentukan dari nama kementerian, perguruan tinggi atau BUMN."}
    if not category.startswith("lkd-"):
        return result
    marker = {"lkd-provinsi": "provinsi", "lkd-kabupaten": "kabupaten", "lkd-kota": "kota"}[category]
    name = region_name(name)
    explicit = re.search(r"\b" + marker + r"\s+(.+)$", name)
    result.update(locationVerificationStatus="needs-review",
                  locationVerificationNotes="Nama administratif belum cocok persis dan tunggal dengan referensi; perlu tinjauan manual.")
    if not explicit:
        return result
    suffix = explicit.group(1)
    candidates = []
    for region in refs["provinces"] if category == "lkd-provinsi" else refs["kabKota"]:
        candidate = region_name(region["name"])
        if category != "lkd-provinsi":
            # Referensi lama BIG memakai nama kabupaten tanpa awalan; kota tetap berawalan Kota.
            is_city = candidate.startswith("kota ") or region.get("administrativeType") == "kota"
            if (category == "lkd-kota") != is_city:
                continue
        candidate = re.sub(r"^(provinsi|kabupaten|kota)\s+", "", candidate)
        if candidate == suffix:
            candidates.append(region)
    if len(candidates) != 1:
        if len(candidates) > 1:
            result["locationVerificationNotes"] = "Nama wilayah ambigu: " + ", ".join(r["id"] for r in candidates)
        return result
    region = candidates[0]
    province = region if category == "lkd-provinsi" else next(p for p in refs["provinces"] if p["id"] == region["provinceId"])
    result.update(provinceId=province["id"], provinceName=province["name"],
                  kabKotaId=None if category == "lkd-provinsi" else region["id"],
                  kabKotaName=None if category == "lkd-provinsi" else region["name"],
                  locationVerificationStatus="verified",
                  locationVerificationNotes=f"Nama administratif eksplisit cocok persis dan tunggal; referensi {region['source']}. Ini wilayah layanan/identitas, bukan koordinat kantor.")
    return result


def import_rows(rows: list[dict], refs: dict, source_name: str, captured_at: str,
                previous_registry: dict | None = None) -> tuple[dict, dict, dict, dict]:
    captured = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
    if captured.tzinfo is None:
        raise ValueError("capturedAt harus memiliki zona waktu.")
    validate_references(refs)
    header = {r["row"]: r["cells"] for r in rows if r["row"] <= 3}
    for col, expected in [("C", "Kode Unik"), ("D", "Nama Instansi"), ("E", "Tahun")]:
        if normalize(text_value(header.get(1, {}).get(col))) != normalize(expected):
            raise ValueError(f"Header {col}1 tidak sesuai '{expected}'.")
    for col, (_, expected, _) in CATEGORIES.items():
        if normalize(text_value(header.get(2, {}).get(col))) != normalize(expected):
            raise ValueError(f"Header kategori {col}2 tidak sesuai '{expected}'.")
    records, errors, warnings, skipped, registry = [], [], [], [], {}
    code_groups = defaultdict(list)
    for row in rows:
        number, cells = row["row"], row["cells"]
        if number < 4:
            continue
        name, code = text_value(cells.get("D")), text_value(cells.get("C")) or None
        if not name and code:
            errors.append({"row": number, "name": name, "kode": code, "issues": ["Kode terisi tetapi nama instansi kosong."]})
            continue
        if not name or re.fullmatch(r"total(?:\s.*)?", name, re.IGNORECASE):
            skipped.append({"row": number, "reason": "Baris kosong/tanpa identitas atau Total."})
            continue
        record_errors = []
        if name.isnumeric() or cells.get("D", {}).get("type") == "e":
            record_errors.append("Nama instansi bukan identitas teks yang sah.")
        year_text = text_value(cells.get("E"))
        year = int(year_text) if re.fullmatch(r"\d{4}", year_text) else None
        if year is None or not 1900 <= year <= captured.year:
            record_errors.append("Tahun bergabung kosong/tidak sah/melampaui tanggal acuan.")
        selected = [CATEGORIES[col][0] for col in CATEGORIES
                    if text_value(cells.get(col)).casefold() not in ("", "0", "0.0", "false")]
        if len(selected) != 1:
            record_errors.append(f"Harus satu kategori, ditemukan {len(selected)}.")
        for col in SELECTED:
            if cells.get(col, {}).get("type") == "e" or (cells.get(col, {}).get("hasFormula") and not cells[col]["value"]):
                record_errors.append(f"Sel {col}{number} error atau formula tanpa cache; perlu verifikasi sumber.")
        if record_errors:
            errors.append({"row": number, "name": name, "kode": code, "issues": record_errors})
            continue
        identifier = local_id(code, name)
        if identifier in registry:
            errors.append({"row": number, "name": name, "kode": code,
                           "issues": [f"Identitas kode+nama berulang/collision dengan baris {registry[identifier]['row']}; tidak digabung."]})
            continue
        category = selected[0]
        source = f"{source_name} — sheet {SHEET}, baris {number}, kolom C–E dan H–P"
        record = {"id": identifier, "kode": code, "name": name, "jenisId": category,
                  **match_region(name, category, refs), "joinedYear": year,
                  "joinedYearSource": f"Data Pengelolaan Casefile — {source_name}, {SHEET}!E{number}",
                  "email": None, "phone": None, "status": None, "logoUrl": None,
                  "coordinates": None, "sourceUpdatedAt": None, "source": source,
                  "landingPageUrl": None, "landingPageSource": None,
                  "landingPageVerificationStatus": "unavailable"}
        records.append(record)
        registry[identifier] = {"row": number, "kode": code, "name": name,
                                "fingerprint": digest([code, name, year, category])}
        if code:
            code_groups[code].append({"id": identifier, "name": name, "row": number, "source": source})
        else:
            warnings.append({"row": number, "id": identifier, "issue": "Kode unik kosong; ID lokal menggunakan nama."})
        code_cell = cells.get("C", {})
        if code_cell.get("type") == "n" and code_cell.get("numberFormatId", "0") not in ("0", "1"):
            warnings.append({"row": number, "id": identifier, "kode": code,
                             "issue": "Kode tersimpan numerik dengan format Excel nonumum. Nilai XML mentah dipertahankan, bukan tanggal. Verifikasi kode asli diperlukan.",
                             "numberFormatId": code_cell.get("numberFormatId"), "numberFormat": code_cell.get("numberFormat")})
    counts = Counter(r["jenisId"] for r in records)
    years = [r["joinedYear"] for r in records]
    duplicates = [{"kode": code, "records": group} for code, group in sorted(code_groups.items()) if len(group) > 1]
    differences = []
    if len(records) != 643:
        differences.append(f"Jumlah {len(records)} berbeda dari baseline 643; tidak dipaksakan.")
    for identifier, _, expected in CATEGORIES.values():
        if counts[identifier] != expected:
            differences.append(f"Kategori {identifier}: aktual {counts[identifier]}, baseline {expected}.")
    if years and [min(years), max(years)] != [2015, 2026]:
        differences.append(f"Rentang tahun aktual {min(years)}–{max(years)}, baseline 2015–2026.")
    previous = (previous_registry or {}).get("records", {})
    added, removed = sorted(set(registry) - set(previous)), sorted(set(previous) - set(registry))
    changed = [i for i in sorted(set(registry) & set(previous)) if registry[i]["fingerprint"] != previous[i].get("fingerprint")]
    metadata = {"id": "casefile-" + digest(sorted((r["id"], registry[r["id"]]["fingerprint"]) for r in records))[:16],
                "sources": [f"{source_name} — sheet {SHEET}, kolom C–E dan H–P"],
                "capturedAt": captured_at, "referenceDate": captured.date().isoformat(),
                "coverage": "full", "datasetKind": "excel", "metricDefinitions": {}, "nationalTotal": None,
                "coverageDescription": "Seluruh instansi pada sheet pengelolaan casefile dalam workbook pengguna; bukan total seluruh JIKN.",
                "verificationNotes": ["Snapshot Excel pengguna; cakupan full berarti seluruh baris instansi workbook ini, bukan total nasional JIKN.",
                                      "Tahun bergabung bersumber dari Data Pengelolaan Casefile, bukan API SIKN.",
                                      "Tanggal acuan adalah tanggal impor; tanggal pembaruan sumber tidak tersedia. Data bukan real-time.",
                                      "Kolom PIC/kontak/internal tidak diimpor. Statistik, koordinat kantor dan hyperlink tidak tersedia dari kolom yang diizinkan.",
                                      "Kode format numerik nonumum dan duplikat tercantum dalam laporan validasi lokal."]}
    summary_differences = []
    for col, (category, _, _) in CATEGORIES.items():
        summary = text_value(header.get(3, {}).get(col))
        if summary and summary != str(counts[category]):
            summary_differences.append({"category": category, "cell": col + "3", "summaryValue": summary,
                                        "actualRecords": counts[category], "note": "Baris 3 hanya ringkasan; tidak dipakai untuk menghitung instansi."})
    report = {"source": metadata["sources"][0], "capturedAt": captured_at,
              "recordsAccepted": len(records), "recordsRejected": len(errors), "sourceRows": [min((r["row"] for r in registry.values()), default=None), max((r["row"] for r in registry.values()), default=None)],
              "categories": {i: counts[i] for i, _, _ in CATEGORIES.values()}, "yearRange": [min(years), max(years)] if years else None,
              "locationStatus": dict(Counter(r["locationVerificationStatus"] for r in records)),
              "withCoordinates": 0, "withoutCoordinates": len(records), "landingPagesVerified": 0,
              "landingPagesUnavailable": len(records), "duplicates": duplicates, "warnings": warnings,
              "errors": errors, "skippedRows": skipped, "baselineDifferences": differences, "headerSummaryDifferences": summary_differences,
              "identityChanges": {"previousRegistryAvailable": bool(previous_registry), "added": added, "removed": removed, "changed": changed,
                                  "note": "Nama/kode yang berubah menghasilkan ID berbeda dan dilaporkan sebagai added/removed. Jangan menyatukan otomatis berdasarkan nama mirip atau kode duplikat."}}
    exceptions = {"source": metadata["sources"][0], "capturedAt": captured_at,
                  "location": [{"id": r["id"], "kode": r["kode"], "name": r["name"], "jenisId": r["jenisId"],
                                "status": r["locationVerificationStatus"], "reason": r["locationVerificationNotes"], "source": r["source"]}
                               for r in records if r["locationVerificationStatus"] != "verified"],
                  "codeWarnings": warnings, "duplicates": duplicates, "rejected": errors}
    return {"metadata": metadata, "instansi": records, "statistics": []}, report, exceptions, {"algorithm": "sha256(normalized-code, normalized-name)/24-v1", "records": registry}


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--references", type=Path, default=Path("public/data/references.json"))
    parser.add_argument("--output", type=Path, default=Path(".local/casefile"))
    parser.add_argument("--captured-at", default=datetime.now().astimezone().isoformat(timespec="seconds"))
    args = parser.parse_args()
    # Mencegah workbook/data internal tidak sengaja ikut aset publik/bundle.
    if "public" in args.output.resolve().parts or "src" in args.output.resolve().parts:
        parser.error("Hasil impor harus di folder lokal review, bukan public/ atau src/.")
    args.output.mkdir(parents=True, exist_ok=True)
    before = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
    try:
        rows = read_selected(args.workbook)
        refs = json.loads(args.references.read_text(encoding="utf-8"))
        registry_path = args.output / "identity-registry.json"
        previous = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else None
        snapshot, report, exceptions, registry = import_rows(rows, refs, args.workbook.name, args.captured_at, previous)
        report["workbookSha256"] = before
        report["referencesSha256"] = hashlib.sha256(args.references.read_bytes()).hexdigest()
        write_json(args.output / "raw-selected.json", {"source": args.workbook.name, "sheet": SHEET, "allowedColumns": sorted(SELECTED), "rows": rows})
        write_json(args.output / "validation-report.json", report)
        write_json(args.output / "exceptions.json", exceptions)
        if report["errors"]:
            print(f"Impor gagal validasi: {len(report['errors'])} baris ditolak. Snapshot lama tidak ditimpa; lihat validation-report.json.", file=sys.stderr)
            return 1
        if hashlib.sha256(args.workbook.read_bytes()).hexdigest() != before:
            raise ValueError("Workbook berubah selama impor; ulangi setelah file stabil.")
        write_json(args.output / "snapshot.json", snapshot)
        write_json(registry_path, registry)
        print(json.dumps({k: report[k] for k in ["recordsAccepted", "categories", "yearRange", "locationStatus", "withCoordinates", "withoutCoordinates", "landingPagesVerified", "landingPagesUnavailable", "baselineDifferences"]}, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, KeyError, ET.ParseError) as error:
        print(f"Impor dihentikan: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
