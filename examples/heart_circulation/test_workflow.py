"""Offline checks for the scientific input and transient contracts."""
import csv
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

import workflow


class CardiacInputs(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.rows = [
            dict(time=t, QAV=q, pressure_AA=10665.76, pARSYS=80, volume_LV=100)
            for t, q in ((0, -2), (4, 3), (8, -1))
        ]

    def convert(self):
        source = self.root / "source.csv"
        with source.open("w") as stream:
            stream.write("\n")  # The supplied MOX file starts with a blank line.
            writer = csv.DictWriter(stream, fieldnames=self.rows[0])
            writer.writeheader()
            writer.writerows(self.rows)
        return workflow.cardiac_inputs(source, self.root)

    def test_preserves_time_negative_flow_and_pressure_units(self):
        receipt = self.convert()
        with (self.root / "inflow.csv").open() as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual([float(row["time_s"]) for row in rows], [0, 4, 8])
        for row, expected in zip(rows, (-0.000002, 0.000003, -0.000001)):
            self.assertAlmostEqual(float(row["flow_m3_s"]), expected, delta=1e-20)
        with (self.root / "heart_reference.csv").open() as stream:
            reference = list(csv.DictReader(stream))
        self.assertTrue(all(float(row["pressure_Pa"]) == 10665.76 for row in reference))
        self.assertEqual(receipt["samples"], 3)

    def test_rejects_duplicate_times(self):
        self.rows[1]["time"] = 0
        with self.assertRaises(ValueError):
            self.convert()
        self.assertFalse((self.root / "inflow.csv").exists())

    def test_rejects_nonfinite_flow(self):
        self.rows[1]["QAV"] = "nan"
        with self.assertRaises(ValueError):
            self.convert()

    def test_rejects_a_changed_pressure_mapping(self):
        self.rows[1]["pARSYS"] = 65
        with self.assertRaisesRegex(ValueError, "pressure_AA"):
            self.convert()

    def test_rejects_an_incomplete_history(self):
        self.rows[-1]["time"] = 7
        with self.assertRaises(ValueError):
            self.convert()


class ParameterContracts(unittest.TestCase):
    def values(self, model):
        text = workflow.parameters(SimpleNamespace(model=model, refinements=3), Path("/run"))
        self.assertNotIn("@", text)
        return dict(
            tuple(part.strip() for part in line.strip()[4:].split("=", 1))
            for line in text.splitlines() if line.strip().startswith("set ")
        )

    def test_preserves_the_two_tutorial_flux_and_junction_models(self):
        full, reduced = self.values("adavn_full"), self.values("adan56")
        self.assertEqual(full["Wall model"], "ADAVN mixed")
        self.assertEqual(full["Terminal connections CSV file"], "/run/network/connections.csv")
        self.assertEqual(full["Numerical flux type"], "HLL_HDG")
        self.assertEqual(float(full["Gamma (Total pressure factor)"]), 1)
        self.assertEqual(reduced["Numerical flux type"], "HLL")
        self.assertEqual(float(reduced["Gamma (Total pressure factor)"]), 0.8)
        self.assertEqual(float(reduced["Theta (penalty parameter)"]), 1)
        self.assertNotIn("Terminal connections CSV file", reduced)

    def test_four_complete_cycles_use_final_tolerances_without_repetition(self):
        for model in ("adavn_full", "adan56"):
            with self.subTest(model=model):
                values = self.values(model)
                final = float(values["Final time"])
                ramp_end = float(values["Tolerance ramp end time"])
                cadence = float(values["Time interval between each output"])
                self.assertAlmostEqual(final - ramp_end, 4 * 0.8)
                self.assertAlmostEqual(ramp_end / cadence, round(ramp_end / cadence))
                self.assertLess(float(values["Tolerance ramp hold duration"]), ramp_end)
                self.assertGreaterEqual(float(values["Tolerance ramp initial relative factor"]), 100)
                self.assertEqual(float(values["Relative error tolerance"]), 1e-5)
                self.assertEqual(float(values["Inflow CSV period"]), 0)
                self.assertNotIn("Inflow function", values)


if __name__ == "__main__":
    unittest.main()
