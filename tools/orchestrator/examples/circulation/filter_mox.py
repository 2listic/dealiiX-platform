#!/usr/bin/env python3
"""Extract the signed MOX aortic-valve flow in MetricFlowX's SI CSV format."""

import csv
import math
import sys


def convert(source, destination):
    with open(source, encoding="utf-8-sig", newline="") as input_stream, open(
        destination, "w", newline=""
    ) as output_stream:
        reader = csv.DictReader(input_stream)
        writer = csv.writer(output_stream)
        writer.writerow(("time_s", "flow_m3_s"))
        previous = None
        for row in reader:
            time, flow = float(row["time"]), float(row["QAV"])
            if not math.isfinite(time) or not math.isfinite(flow):
                raise ValueError("MOX forcing contains a non-finite sample")
            if (previous is None and time != 0) or (previous is not None and time <= previous):
                raise ValueError("MOX time must start at zero and strictly increase")
            writer.writerow((time, flow * 1e-6))
            previous = time
        if previous is None or previous == 0:
            raise ValueError("MOX forcing must contain at least two samples")


if __name__ == "__main__":
    convert(*sys.argv[1:])
