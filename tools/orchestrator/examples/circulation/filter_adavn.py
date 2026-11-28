#!/usr/bin/env python3
"""Extract IRCAD11 hepatic arterial flow and IVC pressure from ADAVN terminals."""

import csv
import math
import sys

HEPATIC = (900, 901, 903, 904, 905, 906, 907, 908)
IVC = 1508


def convert(source, inlet, venous, final_time):
    needed = {*HEPATIC, IVC}
    series = {}
    with open(source, newline="") as stream:
        for row in csv.DictReader(stream):
            boundary = int(row["boundary_id"])
            if boundary not in needed:
                continue
            time = float(row["time_s"])
            flow = float(row["flow_m3_s"])
            pressure = float(row["pressure_Pa"])
            frame = series.setdefault(time, {})
            if boundary in frame or not all(map(math.isfinite, (time, flow, pressure))):
                raise ValueError(f"Invalid ADAVN sample for boundary {boundary} at {time}")
            frame[boundary] = (flow, pressure)
    times = sorted(series)
    if not times or times[0] != 0 or not math.isclose(times[-1], float(final_time), abs_tol=1e-9):
        raise ValueError("ADAVN terminal history does not cover the requested interval")
    if any(set(frame) != needed for frame in series.values()):
        raise ValueError("Incomplete ADAVN hepatic or IVC terminal history")
    with open(inlet, "w", newline="") as arterial, open(venous, "w", newline="") as outlet:
        ha, ivc = csv.writer(arterial), csv.writer(outlet)
        ha.writerow(("time_s", "flow_m3_s"))
        ivc.writerow(("time_s", "pressure_Pa"))
        for time in times:
            ha.writerow((time, math.fsum(series[time][boundary][0] for boundary in HEPATIC)))
            ivc.writerow((time, series[time][IVC][1]))


if __name__ == "__main__":
    convert(*sys.argv[1:])
