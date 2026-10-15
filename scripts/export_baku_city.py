"""Extract building and green-space polygons from an OSM API XML bbox export.

Usage: python scripts/export_baku_city.py input.osm src/components/baku-city.json
Source: https://api.openstreetmap.org/api/0.6/map?bbox=49.846,40.370,49.866,40.383
"""

import json
import sys
import xml.etree.ElementTree as ET


def main(source: str, target: str) -> None:
    root = ET.parse(source).getroot()
    nodes = {
        node.attrib["id"]: [round(float(node.attrib["lon"]), 7), round(float(node.attrib["lat"]), 7)]
        for node in root.findall("node")
    }
    buildings = []
    green = []
    for way in root.findall("way"):
        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
        refs = [node.attrib["ref"] for node in way.findall("nd")]
        if len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            continue
        polygon = [nodes[ref] for ref in refs[:-1]]
        if "building" in tags:
            height = tags.get("height", "").removesuffix(" m")
            try:
                height = max(5, min(70, float(height)))
            except ValueError:
                try:
                    height = max(6, min(65, float(tags.get("building:levels", "3")) * 3.4))
                except ValueError:
                    height = 10
            buildings.append({"p": polygon, "h": round(height, 1)})
        elif tags.get("leisure") in {"park", "garden", "playground"} or tags.get("landuse") in {"grass", "recreation_ground", "village_green"} or tags.get("natural") in {"grassland", "wood"}:
            green.append(polygon)
    with open(target, "w", encoding="utf-8") as output:
        json.dump({"buildings": buildings, "green": green}, output, separators=(",", ":"))
    print(f"Exported {len(buildings)} buildings and {len(green)} green polygons")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
