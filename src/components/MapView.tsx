"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker, StyleSpecification } from "maplibre-gl";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  off?: boolean;
  selected?: boolean;
}

// CARTO Positron (OpenStreetMap data): free with attribution, no API key.
// Set NEXT_PUBLIC_MAP_STYLE=osm to fall back to plain OSM raster tiles.
const OSM_RASTER: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
const STYLE: string | StyleSpecification =
  process.env.NEXT_PUBLIC_MAP_STYLE === "osm" ? OSM_RASTER : process.env.NEXT_PUBLIC_MAP_STYLE || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export function MapView({
  center,
  zoom = 15,
  markers = [],
  onMarkerClick,
  onMapClick,
  onMoveEnd,
  pick,
  me,
  heat,
  className = "h-72",
  testId,
}: {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onMoveEnd?: (lng: number, lat: number) => void;
  pick?: [number, number] | null; // a draggable-looking pin for the host form
  me?: [number, number] | null;
  heat?: [number, number][];
  className?: string;
  testId?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const markerObjs = useRef<Marker[]>([]);
  const pickObj = useRef<Marker | null>(null);
  const meObj = useRef<Marker | null>(null);
  const cb = useRef({ onMarkerClick, onMapClick, onMoveEnd });
  // Latest props for the imperative map layer (read inside map callbacks).
  const props = useRef({ markers, pick, me, heat });
  const ready = useRef(false);

  const drawMarkers = () => {
    const m = lib.current;
    const inst = map.current;
    if (!m || !inst) return;
    markerObjs.current.forEach((x) => x.remove());
    markerObjs.current = props.current.markers.map((mk) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `pin num${mk.off ? " off" : ""}${mk.selected ? " sel" : ""}`;
      node.textContent = mk.label;
      node.dataset.testid = "map-pin";
      node.setAttribute("aria-label", mk.label);
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        cb.current.onMarkerClick?.(mk.id);
      });
      return new m.Marker({ element: node, anchor: "bottom" }).setLngLat([mk.lng, mk.lat]).addTo(inst);
    });
  };

  const drawPick = () => {
    const m = lib.current;
    const inst = map.current;
    if (!m || !inst) return;
    pickObj.current?.remove();
    const p = props.current.pick;
    pickObj.current = p ? new m.Marker({ color: "#1E4BFF" }).setLngLat(p).addTo(inst) : null;
  };

  const drawMe = () => {
    const m = lib.current;
    const inst = map.current;
    if (!m || !inst) return;
    meObj.current?.remove();
    const p = props.current.me;
    if (p) {
      const node = document.createElement("div");
      node.className = "pin-me";
      meObj.current = new m.Marker({ element: node }).setLngLat(p).addTo(inst);
    } else meObj.current = null;
  };

  // demand heatmap (city view); needs the style to be loaded
  const drawHeat = () => {
    const inst = map.current;
    const h = props.current.heat;
    if (!inst || !ready.current || !h) return;
    const data = { type: "FeatureCollection" as const, features: h.map(([lng, lat]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [lng, lat] } })) };
    const src = inst.getSource("heat") as { setData?: (d: unknown) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    inst.addSource("heat", { type: "geojson", data });
    inst.addLayer({
      id: "heat",
      type: "heatmap",
      source: "heat",
      paint: {
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 12, 15, 30],
        "heatmap-intensity": 0.6,
        "heatmap-opacity": 0.8,
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(30,75,255,0)", 0.2, "rgba(30,75,255,0.35)", 0.5, "#D4A574", 0.8, "#E07A3F", 1, "#B42318"],
      },
    });
  };

  useEffect(() => {
    cb.current = { onMarkerClick, onMapClick, onMoveEnd };
    props.current = { markers, pick, me, heat };
  });

  // create the map once
  useEffect(() => {
    let cancelled = false;
    let inst: MLMap | null = null;
    (async () => {
      const m = await import("maplibre-gl");
      if (cancelled || !el.current) return;
      if (m.getWorkerUrl() !== WORKER_URL) m.setWorkerUrl(WORKER_URL);
      lib.current = m;
      inst = new m.Map({ container: el.current, style: STYLE, center, zoom, attributionControl: { compact: true } });
      inst.addControl(new m.NavigationControl({ showCompass: false }), "top-right");
      inst.on("click", (e) => cb.current.onMapClick?.(e.lngLat.lng, e.lngLat.lat));
      inst.on("moveend", () => {
        const c = inst!.getCenter();
        cb.current.onMoveEnd?.(c.lng, c.lat);
      });
      inst.on("load", () => {
        ready.current = true;
        drawHeat();
      });
      map.current = inst;
      drawMarkers();
      drawPick();
      drawMe();
    })();
    return () => {
      cancelled = true;
      inst?.remove();
      if (map.current === inst) map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fly when the requested centre changes
  useEffect(() => {
    map.current?.flyTo({ center, zoom, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  useEffect(drawMarkers, [markers]);
  useEffect(drawPick, [pick]);
  useEffect(drawMe, [me]);
  useEffect(drawHeat, [heat]);

  return <div ref={el} className={`w-full overflow-hidden rounded-[18px] border border-line bg-[#e9e5dc] ${className}`} data-testid={testId} />;
}

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
