"""Materialize parameter file nodes inside saved CORAL graphs."""

import json
import re
from graphlib import TopologicalSorter
from pathlib import PurePosixPath
from urllib.parse import unquote

from protocol import Error, check, dependencies, leaf, parameter_text

LITERAL_TYPES = {
    "string": "std::string",
    "int": "int",
    "unsigned int": "unsigned int",
    "double": "double",
    "bool": "bool",
}


def parse_prm(text):
    sections = [{}]
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("subsection "):
            section = sections[-1].setdefault(line[11:].strip(), {})
            sections.append(section)
        elif line == "end" and len(sections) > 1:
            sections.pop()
        elif line.startswith("set ") and "=" in line:
            name, value = line[4:].split("=", 1)
            sections[-1][name.strip()] = leaf(value.strip(), "[Anything]", "")
        else:
            raise Error("invalid_parameters", f"Unsupported PRM line {line!r}")
    if len(sections) != 1:
        raise Error("invalid_parameters", "Unterminated PRM subsection")
    return sections[0]


def exposure(node, edge, direction):
    prefix = f"parameter-{direction}-"
    try:
        endpoint = "source" if direction == "output" else "target"
        path = json.loads(unquote(edge[f"{endpoint}_handle"].removeprefix(prefix)))
        return next(
            item
            for item in node["parameter_file"]["exposures"]
            if item["path"] == path and item[direction]
        )
    except (KeyError, ValueError, StopIteration) as error:
        raise Error(
            "invalid_edge",
            f"{node['qualified_id']}: undeclared {direction} parameter port",
        ) from error


def entry(tree, path, qid):
    for key in path:
        tree = tree.get(key) if isinstance(tree, dict) else None
    if not isinstance(tree, dict) or not isinstance(tree.get("value"), str):
        raise Error(
            "invalid_parameters", f"{qid}: missing parameter {' / '.join(path)}"
        )
    return tree


def convert(value, kind, qid):
    if kind == "string":
        return value
    if kind == "bool" and value in {"true", "false"}:
        return value
    if (
        kind in {"int", "unsigned int"}
        and re.fullmatch(r"[+-]?[0-9]+", value)
        and (kind == "int" or int(value) >= 0)
    ):
        return str(int(value))
    if kind == "double" and re.fullmatch(
        r"[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?", value
    ):
        return value
    raise Error(
        "invalid_parameters", f"{qid}: {value!r} is invalid for a {kind} parameter"
    )


def stage_parameter_files(network, load, registry, artifacts, occupied):
    workflow = network["workflow"]
    nodes, edges = workflow["nodes"], workflow["edges"]
    trees = {}
    filenames = {}
    for key, node in nodes.items():
        if node.get("node_type") == "network":
            stage_parameter_files(node["value"], load, registry, artifacts, occupied)
        if "parameter_file" not in node:
            continue
        qid = node["qualified_id"]
        source = node.get("value", "")
        suffix = PurePosixPath(source).suffix
        if suffix not in {".json", ".prm"} or "\x00" in source:
            raise Error(
                "invalid_parameters", f"{qid}: expected a .json or .prm source file"
            )
        filename = f"parameter-{qid}{suffix}"
        filenames[key] = filename
        content = load(source)
        if node["parameter_file"]["exposures"]:
            tree = json.loads(content) if suffix == ".json" else parse_prm(content)
            check("parameters", tree, "invalid_parameters")
            trees[key] = tree
            for item in node["parameter_file"]["exposures"]:
                entry(tree, item["path"], qid)
        else:
            artifacts[filename] = content
    if not trees:
        finish_files(nodes, filenames)
        return
    order = list(TopologicalSorter(dependencies(workflow)).static_order())
    incoming = {}
    for edge in edges.values():
        if "target_handle" in edge:
            incoming.setdefault(str(edge["target"]), []).append(edge)
    for key in order:
        if key not in trees:
            continue
        node = nodes[key]
        qid = node["qualified_id"]
        needed = {
            tuple(item["path"])
            for item in node["parameter_file"]["exposures"]
            if item["input"]
        }
        for edge in incoming.get(key, []):
            binding = exposure(node, edge, "input")
            path = tuple(binding["path"])
            if path not in needed:
                raise Error("invalid_edge", f"{qid}: repeated parameter input {path}")
            needed.remove(path)
            source_key = str(edge["source"])
            source = nodes[source_key]
            if "source_handle" in edge:
                output = exposure(source, edge, "output")
                value = entry(
                    trees[source_key], output["path"], source["qualified_id"]
                )["value"]
            elif (
                edge["source_output"] == 0
                and source["type"] in LITERAL_TYPES.values()
                and source_key not in filenames
                and isinstance(source.get("value"), str)
            ):
                value = source["value"]
            else:
                raise Error(
                    "invalid_edge",
                    f"{qid}: parameter input requires a literal or a parameter output",
                )
            entry(trees[key], path, qid)["value"] = convert(value, binding["type"], qid)
        if needed:
            raise Error("invalid_edge", f"{qid}: missing bindings for {sorted(needed)}")
        artifacts[filenames[key]] = parameter_text(trees[key], filenames[key])

    next_id = max(map(int, nodes), default=-1) + 1
    for key, edge in list(edges.items()):
        if "target_handle" in edge:
            exposure(nodes[str(edge["target"])], edge, "input")
            del edges[key]
        elif "source_handle" in edge:
            source_key = str(edge["source"])
            source = nodes[source_key]
            output = exposure(source, edge, "output")
            literal_type = LITERAL_TYPES[output["type"]]
            if literal_type == "unsigned int" and literal_type not in registry:
                literal_type = "int"
            if literal_type not in registry:
                raise Error(
                    "unknown_node", f"The CORAL plugin cannot construct {literal_type}"
                )
            while f"{source['qualified_id']}_parameter_{next_id}" in occupied:
                next_id += 1
            qid = f"{source['qualified_id']}_parameter_{next_id}"
            occupied.add(qid)
            value = entry(trees[source_key], output["path"], source["qualified_id"])[
                "value"
            ]
            nodes[str(next_id)] = {
                "type": literal_type,
                "qualified_id": qid,
                "value": convert(value, output["type"], qid),
            }
            edge["source"] = next_id
            edge["source_output"] = 0
            del edge["source_handle"]
            next_id += 1
    finish_files(nodes, filenames)


def finish_files(nodes, filenames):
    for key, filename in filenames.items():
        del nodes[key]["parameter_file"]
        nodes[key]["value"] = filename
