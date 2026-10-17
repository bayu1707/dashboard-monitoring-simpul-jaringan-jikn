"""Fixture seluruhnya sintetis. Jalankan: python3 -m unittest discover -s tests -p 'test_import_*.py'."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("casefile", ROOT / "scripts/import-casefile.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def cell(value, kind="s", **extra):
    return {"value": str(value), "type": kind, "numberFormatId": "0", "numberFormat": None, "hasFormula": False, **extra}


def row(number=4, name="Instansi Demo Kabupaten Serang", code="00001-1", year="2020", category="J"):
    return {"row": number, "cells": {"C": cell(code), "D": cell(name), "E": cell(year), category: cell(1, "n")}}


def rows(*records):
    return [{"row": 1, "cells": {"C": cell("Kode Unik"), "D": cell("Nama Instansi"), "E": cell("Tahun")}},
            {"row": 2, "cells": {col: cell(label) for col, (_, label, _) in MODULE.CATEGORIES.items()}},
            {"row": 3, "cells": {"J": cell(999)}}] + list(records)


REFS = {"provinces": [{"id": "36", "name": "Banten", "source": "referensi sintetis"}],
        "kabKota": [{"id": "36.04", "name": "Kabupaten Serang", "provinceId": "36", "source": "referensi sintetis"},
                    {"id": "36.73", "name": "Kota Serang", "provinceId": "36", "source": "referensi sintetis"}]}


def run(records, previous=None, refs=None):
    return MODULE.import_rows(rows(*records), refs or REFS, "fixture-sintetis.xlsx", "2026-10-14T12:00:00+07:00", previous)


class ImportCasefileTests(unittest.TestCase):
    def test_row_reorder_preserves_identity_and_detects_year_change(self):
        original = [row(), row(5, "Instansi Demo Kota Serang", "00002", category="K")]
        snapshot, _, _, registry = run(original)
        reordered = [row(10, "Instansi Demo Kota Serang", "00002", category="K"), row(20)]
        next_snapshot, report, _, _ = run(reordered, registry)
        self.assertEqual({i["id"] for i in snapshot["instansi"]}, {i["id"] for i in next_snapshot["instansi"]})
        self.assertEqual(report["identityChanges"]["added"], [])
        self.assertEqual(report["identityChanges"]["removed"], [])
        self.assertEqual(report["identityChanges"]["changed"], [])
        _, changed, _, _ = run([row(year="2021"), original[1]], registry)
        self.assertEqual(changed["identityChanges"]["changed"], [snapshot["instansi"][0]["id"]])

    def test_duplicate_codes_are_reported_without_merging_names(self):
        snapshot, report, _, _ = run([row(), row(5, "Instansi Demo B", category="H")])
        self.assertEqual(len(snapshot["instansi"]), 2)
        self.assertEqual(len({i["id"] for i in snapshot["instansi"]}), 2)
        self.assertEqual(report["duplicates"][0]["kode"], "00001-1")
        self.assertEqual(len(report["duplicates"][0]["records"]), 2)

    def test_exact_identity_collision_is_an_error_not_silent_merge(self):
        _, report, _, _ = run([row(), row(5)])
        self.assertEqual(report["recordsRejected"], 1)
        self.assertIn("tidak digabung", report["errors"][0]["issues"][0])

    def test_name_change_is_reported_and_not_assigned_previous_id(self):
        _, _, _, registry = run([row()])
        _, report, _, _ = run([row(name="Instansi Demo Baru Kabupaten Serang")], registry)
        self.assertEqual(len(report["identityChanges"]["added"]), 1)
        self.assertEqual(len(report["identityChanges"]["removed"]), 1)

    def test_exact_kabupaten_and_kota_are_distinct(self):
        snapshot, _, _, _ = run([row(), row(5, "Instansi Demo Kota Serang", "02", category="K")])
        self.assertEqual([i["kabKotaId"] for i in snapshot["instansi"]], ["36.04", "36.73"])
        self.assertTrue(all(i["locationVerificationStatus"] == "verified" for i in snapshot["instansi"]))
        self.assertTrue(all(i["coordinates"] is None for i in snapshot["instansi"]))

    def test_province_only_and_unknown_are_preserved_without_invented_points(self):
        snapshot, _, exceptions, _ = run([row(name="Instansi Demo Provinsi Banten", category="I"),
                                         row(5, "Universitas Demo di Serang", "02", category="L"),
                                         row(6, "Instansi Demo Kabupaten Salah Eja", "03")])
        province, unknown, review = snapshot["instansi"]
        self.assertEqual(province["provinceId"], "36")
        self.assertIsNone(province["kabKotaId"])
        self.assertIsNone(unknown["provinceId"])
        self.assertEqual(unknown["locationVerificationStatus"], "unresolved")
        self.assertEqual(review["locationVerificationStatus"], "needs-review")
        self.assertEqual(len(exceptions["location"]), 2)
        self.assertEqual(snapshot["statistics"], [])
        self.assertIsNone(snapshot["metadata"]["nationalTotal"])
        self.assertTrue(all(i["landingPageUrl"] is None for i in snapshot["instansi"]))

    def test_ambiguous_names_never_choose_first_region(self):
        refs = copy.deepcopy(REFS)
        refs["kabKota"].append({"id": "36.99", "name": "Kabupaten Serang", "provinceId": "36", "source": "sintetis"})
        snapshot, _, _, _ = run([row()], refs=refs)
        self.assertIsNone(snapshot["instansi"][0]["provinceId"])
        self.assertIn("ambigu", snapshot["instansi"][0]["locationVerificationNotes"])

    def test_future_year_and_multiple_categories_are_rejected(self):
        invalid = row(5, "Instansi Demo B", "02")
        invalid["cells"]["H"] = cell(1)
        _, report, _, _ = run([row(year="2027"), invalid])
        self.assertEqual(report["recordsRejected"], 2)

    def test_summary_and_trailing_total_are_not_records(self):
        snapshot, report, _, _ = run([row(), {"row": 50, "cells": {}}, row(51, "Total")])
        self.assertEqual(len(snapshot["instansi"]), 1)
        self.assertEqual(len(report["skippedRows"]), 2)
        self.assertEqual(report["headerSummaryDifferences"][0]["actualRecords"], 1)

    def test_header_and_parent_reference_are_checked(self):
        with self.assertRaisesRegex(ValueError, "Header"):
            MODULE.import_rows([row()], REFS, "fixture.xlsx", "2026-10-14T12:00:00+07:00")
        refs = copy.deepcopy(REFS)
        refs["kabKota"][0]["provinceId"] = "invalid"
        with self.assertRaisesRegex(ValueError, "induk"):
            run([row()], refs=refs)

    def test_xml_reader_preserves_text_zeroes_and_numeric_bad_date_without_private_columns(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "fixture.xlsx"
            with ZipFile(path, "w") as archive:
                archive.writestr("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="pengelolaan casefile" sheetId="1" r:id="rId7"/></sheets></workbook>')
                archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId7" Target="worksheets/sheet1.xml"/></Relationships>')
                archive.writestr("xl/styles.xml", '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>')
                archive.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="4"><c r="C4" t="inlineStr"><is><t>00123-1</t></is></c><c r="F4" t="inlineStr"><is><t>PRIVATE_PERSON</t></is></c><c r="G4" t="inlineStr"><is><t>PRIVATE_CONTACT</t></is></c></row><row r="5"><c r="C5" s="1"><v>3690259.0</v></c></row></sheetData></worksheet>')
            before = path.read_bytes()
            selected = MODULE.read_selected(path)
            self.assertEqual(MODULE.text_value(selected[0]["cells"]["C"]), "00123-1")
            self.assertEqual(MODULE.text_value(selected[1]["cells"]["C"]), "3690259")
            self.assertNotIn("F", selected[0]["cells"])
            self.assertNotIn("G", selected[0]["cells"])
            self.assertNotIn("PRIVATE", str(selected))
            self.assertEqual(before, path.read_bytes())


if __name__ == "__main__":
    unittest.main()
