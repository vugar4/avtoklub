"""Convert an OpenStreetMap API bbox export into compact drivable street lines.

Usage: python scripts/export_baku_roads.py input.osm src/components/baku-roads.json
Source bbox: https://api.openstreetmap.org/api/0.6/map?bbox=49.846,40.370,49.866,40.383
"""

import json
import sys
import xml.etree.ElementTree as ET

ALLOWED = {
    "trunk", "trunk_link", "primary", "primary_link", "secondary",
    "secondary_link", "tertiary", "tertiary_link", "residential",
    "unclassified", "service", "living_street",
}


def main(source: str, target: str) -> None:
    root = ET.parse(source).getroot()
    nodes = {
        node.attrib["id"]: [float(node.attrib["lon"]), float(node.attrib["lat"])]
        for node in root.findall("node")
    }
    roads = []
    for way in root.findall("way"):
        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
        kind = tags.get("highway")
        if kind not in ALLOWED or tags.get("access") in {"no", "private"} or tags.get("motor_vehicle") == "no":
            continue
        points = [nodes[ref.attrib["ref"]] for ref in way.findall("nd") if ref.attrib["ref"] in nodes]
        if len(points) > 1:
            roads.append({"kind": kind, "points": points})
    with open(target, "w", encoding="utf-8") as output:
        json.dump(roads, output, ensure_ascii=False, separators=(",", ":"))
    print(f"Exported {len(roads)} roads with {sum(len(road['points']) - 1 for road in roads)} segments")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
