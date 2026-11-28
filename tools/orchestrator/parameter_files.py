"""Materialize parameter file nodes inside saved CORAL graphs."""

import json
import re
from graphlib import TopologicalSorter
from pathlib import PurePosixPath
from urllib.parse import unquote

from protocol import (
    LITERAL_DEFAULTS,
    SELECTION_TYPE,
    Error,
    check,
    dependencies,
    leaf,
    merge_choices,
    parameter_text,
)

LITERAL_TYPES = {
    "string": "std::string",
    "int": "int",
    "unsigned int": "unsigned int",
    "double": "double",
    "bool": "bool",
}

LITERAL_KINDS = {type_name: kind for kind, type_name in LITERAL_TYPES.items()}


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


def exposure(node, edge, direction, metadata="parameter_file"):
    prefix = f"parameter-{direction}-"
    try:
        endpoint = "source" if direction == "output" else "target"
        handle = edge[f"{endpoint}_handle"]
        if not handle.startswith(prefix):
            raise ValueError("Invalid parameter handle")
        path = json.loads(unquote(handle.removeprefix(prefix)))
        return next(
            item
            for item in node[metadata]["exposures"]
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


def validate_selections(template, choices, qid):
    for key, declared in template.items():
        actual = choices.get(key)
        if not isinstance(declared, dict) or not isinstance(actual, dict):
            continue
        if "value" not in declared:
            if "value" not in actual:
                validate_selections(declared, actual, f"{qid}.{key}")
            continue
        sibling = declared.get("selection_options")
        pattern = re.fullmatch(r"\[Selection\s+(.*?)\]", declared["pattern_description"])
        if sibling is None and pattern is None:
            continue
        text = entry(choices, [sibling], qid)["value"] if sibling else pattern[1]
        options = [option.strip() for option in text.split("|") if option.strip()]
        if actual.get("value") not in options:
            raise Error("invalid_parameters", f"{qid}.{key}: choose one of {options}")


def bind_configuration(workflow, registry):
    """Resolve exposed values before scheduling, leaving the saved graph intact."""
    metadata = "configuration_exposures"
    nodes, edges = workflow["nodes"], workflow["edges"]
    choices = {}
    literals = {}
    for key, node in nodes.items():
        type_name = node["type"]
        if type_name in LITERAL_DEFAULTS:
            qid = node["qualified_id"]
            definition = registry[type_name]
            if (
                node.get("node_type", definition["node_type"]) != definition["node_type"]
                or "configuration" in node
                or "parameter_file" in node
            ):
                raise Error("invalid_network", f"{qid}: set literal text in value")
            for field in ("arguments", "inputs", "outputs"):
                if node.get(field, definition[field]) != definition[field]:
                    raise Error("invalid_network", f"{qid}: {field} disagrees with the literal registry")
            literals[key] = convert(
                node.get("value", definition["value"]), LITERAL_KINDS[type_name], qid
            )
            continue
        if type_name == SELECTION_TYPE:
            qid = node["qualified_id"]
            if node.get("node_type", "void_function") != "void_function" or "value" in node or "parameter_file" in node:
                raise Error("invalid_network", f"{qid}: set Selection options in configuration")
            template = registry[SELECTION_TYPE]["configuration"]
            choices[key] = merge_choices(template, node.get("configuration", {}), qid)
            validate_selections(template, choices[key], qid)
        if metadata not in node:
            continue
        qid = node["qualified_id"]
        definition = registry.get(node["type"], {})
        if not definition.get("capabilities", {}).get("configuration_exposable"):
            raise Error("invalid_parameters", f"{qid}: this node cannot expose configuration")
        values = merge_choices(definition["configuration"], node["configuration"], qid)
        seen = set()
        for port in node[metadata]["exposures"]:
            path = tuple(port["path"])
            if path in seen or not (port["input"] or port["output"]):
                raise Error("invalid_parameters", f"{qid}: invalid repeated or unused exposure {path}")
            seen.add(path)
            entry(values, path, qid)
        choices[key] = values

    incoming = {}
    configuration_edges = {}
    execution_edges = {}
    for key, edge in edges.items():
        if "source_handle" not in edge and "target_handle" not in edge:
            execution_edges[key] = edge
            continue
        configuration_edges[key] = edge
        incoming.setdefault(str(edge["target"]), []).append(edge)
    parents = dependencies({**workflow, "edges": configuration_edges})
    for target in TopologicalSorter(parents).static_order():
        seen = set()
        for edge in incoming.get(target, []):
            source = str(edge["source"])
            port = exposure(nodes[target], edge, "input", metadata)
            qid = nodes[target]["qualified_id"]
            path = tuple(port["path"])
            value = literals.get(source)
            if value is not None:
                if edge.get("source_output") != 0:
                    raise Error("invalid_edge", f"{qid}: expected the literal output")
                output_type = nodes[source]["type"]
            elif "source_handle" in edge:
                output = exposure(nodes[source], edge, "output", metadata)
                output_path = output["path"]
                output_type = LITERAL_TYPES[output["type"]]
            else:
                definition = registry.get(nodes[source]["type"], {})
                try:
                    index = definition["outputs"][edge["source_output"]]
                    argument = definition["arguments"][index] if index >= 0 else {}
                    output_path = argument["configuration_path"]
                except (IndexError, KeyError) as error:
                    raise Error("invalid_edge", f"{qid}: expected a configuration output") from error
                output_type = argument["type"]
            if path in seen or output_type != LITERAL_TYPES[port["type"]]:
                raise Error("invalid_edge", f"{qid}: incompatible or repeated input for {path}")
            seen.add(path)
            if value is None:
                value = entry(
                    choices.get(source, {}), output_path, nodes[source]["qualified_id"]
                )["value"]
                value = convert(value, port["type"], qid)
            entry(choices[target], path, qid)["value"] = value
    return choices, execution_edges


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
