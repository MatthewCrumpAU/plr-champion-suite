"use client";

import * as React from "react";
import type Konva from "konva";
import { Stage, Layer, Rect, Text, Ellipse, Line, Image as KImage, Transformer } from "react-konva";
import type { CoverData, CoverElement } from "@/lib/models/design";
import { coverCrop, elementNode, fillAttrs, type ImageMap } from "@/lib/covers/render";

/**
 * Interactive Konva canvas for the Cover Creator. Pure view: all state lives in the parent.
 * Coordinates are design units (the stage is scaled to fit), so values map 1:1 to the exported image.
 */

export interface CanvasProps {
  data: CoverData;
  scale: number;
  images: ImageMap;
  logo: HTMLImageElement | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CoverElement>) => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
}

const SNAP = 8;

type Box = { x: number; y: number; width: number; height: number };

function edges(b: Box) {
  return { v: [b.x, b.x + b.width / 2, b.x + b.width], h: [b.y, b.y + b.height / 2, b.y + b.height] };
}

export default function CoverCanvas({ data, scale, images, logo, selectedId, onSelect, onChange, stageRef }: CanvasProps) {
  const trRef = React.useRef<Konva.Transformer>(null);
  const layerRef = React.useRef<Konva.Layer>(null);
  const [guides, setGuides] = React.useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const selected = data.elements.find((e) => e.id === selectedId) ?? null;

  React.useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selected && !selected.locked && selected.visible ? stage.findOne(`#${selected.id}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, data, stageRef]);

  const snapTargets = React.useCallback(
    (excludeId: string) => {
      const v = [0, data.width / 2, data.width];
      const h = [0, data.height / 2, data.height];
      const layer = layerRef.current;
      if (layer) {
        for (const el of data.elements) {
          if (el.id === excludeId || !el.visible) continue;
          const n = layer.findOne(`#${el.id}`);
          if (!n) continue;
          const e = edges(n.getClientRect({ relativeTo: layer as unknown as Konva.Container }));
          v.push(...e.v);
          h.push(...e.h);
        }
      }
      return { v, h };
    },
    [data],
  );

  const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const layer = layerRef.current;
    if (!layer) return;
    const box = node.getClientRect({ relativeTo: layer as unknown as Konva.Container });
    const targets = snapTargets(node.id());
    const threshold = SNAP / scale;
    const mine = edges(box);
    let dx: number | null = null;
    let dy: number | null = null;
    const gv: number[] = [];
    const gh: number[] = [];
    for (const t of targets.v)
      for (const m of mine.v) {
        const d = t - m;
        if (Math.abs(d) < threshold && (dx === null || Math.abs(d) < Math.abs(dx))) dx = d;
      }
    for (const t of targets.h)
      for (const m of mine.h) {
        const d = t - m;
        if (Math.abs(d) < threshold && (dy === null || Math.abs(d) < Math.abs(dy))) dy = d;
      }
    if (dx !== null) {
      node.x(node.x() + dx);
      const nb = edges({ ...box, x: box.x + dx });
      for (const t of targets.v) if (nb.v.some((m) => Math.abs(m - t) < 0.5)) gv.push(t);
    }
    if (dy !== null) {
      node.y(node.y() + dy);
      const nb = edges({ ...box, y: box.y + dy });
      for (const t of targets.h) if (nb.h.some((m) => Math.abs(m - t) < 0.5)) gh.push(t);
    }
    setGuides({ v: gv, h: gh });
  };

  const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    setGuides({ v: [], h: [] });
    onChange(e.target.id(), { x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
  };

  const onTransformEnd = (el: CoverElement) => (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    const anchor = trRef.current?.getActiveAnchor() ?? "";
    node.scaleX(1);
    node.scaleY(1);
    const base = { x: Math.round(node.x()), y: Math.round(node.y()), rotation: Math.round(node.rotation() * 10) / 10 };
    if (el.type === "text") {
      const sideOnly = anchor === "middle-left" || anchor === "middle-right";
      onChange(el.id, { ...base, width: Math.max(20, Math.round(el.width * sx)), ...(sideOnly ? {} : { fontSize: Math.max(6, Math.round(el.fontSize * sy)) }) } as Partial<CoverElement>);
    } else if (el.type === "line") {
      onChange(el.id, { ...base, width: Math.max(4, Math.round(el.width * sx)) } as Partial<CoverElement>);
    } else {
      onChange(el.id, { ...base, width: Math.max(4, Math.round(el.width * sx)), height: Math.max(4, Math.round(el.height * sy)) } as Partial<CoverElement>);
    }
  };

  const bgImage = data.backgroundImageFileId ? images.get(data.backgroundImageFileId) : null;

  return (
    <Stage
      ref={stageRef}
      width={Math.round(data.width * scale)}
      height={Math.round(data.height * scale)}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "background") onSelect(null);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "background") onSelect(null);
      }}
    >
      <Layer listening>
        <Rect name="background" x={0} y={0} width={data.width} height={data.height} {...(fillAttrs(data.background, data.width, data.height) as object)} />
        {bgImage && <KImage name="background" x={0} y={0} width={data.width} height={data.height} image={bgImage} crop={coverCrop(bgImage, data.width, data.height)} opacity={data.backgroundImageOpacity} />}
      </Layer>
      <Layer ref={layerRef}>
        {data.elements.map((el) => {
          const n = elementNode(el, images, logo);
          if (!n) return null;
          const handlers = {
            onMouseDown: () => onSelect(el.id),
            onTap: () => onSelect(el.id),
            onDragStart: () => onSelect(el.id),
            onDragMove,
            onDragEnd,
            onTransformEnd: onTransformEnd(el),
          };
          const props = { ...n.attrs, ...handlers } as Record<string, unknown>;
          switch (n.kind) {
            case "Text":
              return <Text key={el.id} {...(props as React.ComponentProps<typeof Text>)} />;
            case "Rect":
              return <Rect key={el.id} {...(props as React.ComponentProps<typeof Rect>)} />;
            case "Ellipse":
              return <Ellipse key={el.id} {...(props as React.ComponentProps<typeof Ellipse>)} />;
            case "Line":
              return <Line key={el.id} {...(props as React.ComponentProps<typeof Line>)} />;
            case "Image":
              return props.image ? <KImage key={el.id} {...(props as React.ComponentProps<typeof KImage>)} /> : <Rect key={el.id} {...(props as React.ComponentProps<typeof Rect>)} dash={[12, 8]} stroke="#9aa1b5" strokeWidth={4} fill="#eef0f6" />;
          }
        })}
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={selected?.type === "text" || selected?.type === "image"}
          enabledAnchors={selected?.type === "line" ? ["middle-left", "middle-right"] : selected?.type === "text" ? ["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right"] : undefined}
          anchorSize={10}
          anchorCornerRadius={3}
          borderStroke="#5b4df5"
          anchorStroke="#5b4df5"
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8 ? oldBox : newBox)}
          ignoreStroke
        />
      </Layer>
      <Layer listening={false}>
        {guides.v.map((x, i) => (
          <Line key={`v${i}`} points={[x, 0, x, data.height]} stroke="#f43f5e" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} />
        ))}
        {guides.h.map((y, i) => (
          <Line key={`h${i}`} points={[0, y, data.width, y]} stroke="#f43f5e" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} />
        ))}
      </Layer>
    </Stage>
  );
}
