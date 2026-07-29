// roadmap.sh-style visual roadmap — React Flow renders the AI's ordered
// steps as a connected node graph (alternating left/right like roadmap.sh).
import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const KIND_STYLE = {
  skill: { chip: "bg-accent/10 text-accent border-accent/25", label: "skill" },
  project: { chip: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25", label: "project" },
  practice: { chip: "bg-amber-500/10 text-amber-500 border-amber-500/25", label: "practice" },
  milestone: { chip: "bg-purple-500/10 text-purple-400 border-purple-400/25", label: "milestone" },
};

// Custom node: a mini bento card with title, hours, why, and resource links.
function StepNode({ data }) {
  const k = KIND_STYLE[data.kind] ?? KIND_STYLE.skill;
  return (
    <div className="w-64 rounded-2xl border border-line bg-surface p-3.5 shadow-md">
      <Handle type="target" position={Position.Top} className="!bg-accent" />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${k.chip}`}>
          {k.label}
        </span>
        <span className="text-[10px] font-semibold text-soft">~{data.estHours}h</span>
      </div>
      <p className="text-sm font-bold leading-snug">{data.title}</p>
      {data.why && <p className="mt-1 text-[11px] leading-relaxed text-soft">{data.why}</p>}
      {data.resources?.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {data.resources.slice(0, 3).map((r, i) =>
            r.url ? (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                 className="block truncate text-[11px] font-medium text-accent hover:underline">
                ↗ {r.title}
              </a>
            ) : (
              <p key={i} className="truncate text-[11px] text-soft">• {r.title}</p>
            )
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent" />
    </div>
  );
}

const nodeTypes = { step: StepNode };

export default function RoadmapFlow({ roadmap }) {
  // Ordered steps → alternating left/right nodes + connecting edges.
  const { nodes, edges } = useMemo(() => {
    const nodes = roadmap.steps.map((s, i) => ({
      id: String(i),
      type: "step",
      position: { x: i % 2 === 0 ? 0 : 320, y: i * 170 },
      data: s,
    }));
    const edges = roadmap.steps.slice(1).map((_, i) => ({
      id: `e${i}`,
      source: String(i),
      target: String(i + 1),
      animated: true,
      style: { stroke: "rgb(var(--accent))", strokeWidth: 2 },
    }));
    return { nodes, edges };
  }, [roadmap]);

  return (
    <div className="h-full min-h-[420px] overflow-hidden rounded-2xl border border-line">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // Navigation feel: wheel PANS the canvas (natural for a vertical
        // roadmap), Ctrl+wheel / pinch zooms, drag pans. No sticking.
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        panOnDrag
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="rgb(var(--line))" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
