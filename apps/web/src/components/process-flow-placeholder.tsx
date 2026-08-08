type ProcessFlowPlaceholderProps = {
  variant: "narrow" | "wide";
};

/**
 * Stellt nur die Form eines möglichen Prozessbilds dar. Die Grafik enthält
 * absichtlich keine Prozessdaten und ist deshalb für Screenreader verborgen.
 */
export function ProcessFlowPlaceholder({
  variant,
}: ProcessFlowPlaceholderProps) {
  const layout =
    variant === "wide"
      ? {
          viewBoxTop: -30,
          viewBoxHeight: 735.62,
          startLabelY: -6,
          firstCardY: 110,
          decisionY: 272,
          branchCardY: 428,
          branchLabelY: 402,
          endY: 669.62,
        }
      : {
          viewBoxTop: -30,
          viewBoxHeight: 615.62,
          startLabelY: -6,
          firstCardY: 80,
          decisionY: 226,
          branchCardY: 340,
          branchLabelY: 318,
          endY: 539.62,
        };

  return (
    <svg
      viewBox={`0 ${layout.viewBoxTop} 568 ${layout.viewBoxHeight + 30}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={
        variant === "narrow"
          ? // Nutzt die schmale Spalte fast vollständig aus (kleiner
            // seitlicher Atemrand über die 96 %). Da die Breite relativ zur
            // Spalte bleibt und das SVG über die viewBox skaliert, kann die
            // Spalte dadurch nicht horizontal scrollen.
            "mx-auto block w-[96%] max-w-[420px] opacity-75"
          : "block w-full max-w-[500px] opacity-75"
      }
    >
      <defs>
        <marker
          id={`process-flow-placeholder-arrow-${variant}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" className="fill-muted-foreground" />
        </marker>
      </defs>
      <g className="fill-card stroke-muted-foreground">
        <circle cx="250" cy="20" r="19.25" strokeWidth="1.5" />
        <text
          x="250"
          y={layout.startLabelY}
          textAnchor="middle"
          className="fill-muted-foreground text-[14px]"
        >
          Start
        </text>
      </g>

      <PlaceholderEdge
        from="250 40"
        to={`250 ${layout.firstCardY - 2}`}
        variant={variant}
      />
      <PlaceholderCard
        x={90}
        y={layout.firstCardY}
        number={1}
        lines={[240, 174]}
      />
      <PlaceholderEdge
        from={`250 ${layout.firstCardY + 92}`}
        to={`250 ${layout.decisionY - 28}`}
        variant={variant}
      />

      <g>
        <circle
          cx="250"
          cy={layout.decisionY}
          r="46"
          className="fill-secondary"
        />
        <rect
          x="231"
          y={layout.decisionY - 19}
          width="38"
          height="38"
          rx="3"
          transform={`rotate(45 250 ${layout.decisionY})`}
          className="fill-card stroke-primary"
          strokeWidth="1.5"
        />
        <path
          d={`M 245.5 ${layout.decisionY - 4.5} L 254.5 ${layout.decisionY + 4.5} M 254.5 ${layout.decisionY - 4.5} L 245.5 ${layout.decisionY + 4.5}`}
          className="fill-none stroke-primary"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <text
          x="250"
          y={layout.decisionY + 42.38}
          textAnchor="middle"
          className="fill-primary text-[14px] font-medium"
        >
          Entscheidung
        </text>
      </g>

      <PlaceholderEdge
        from={`250 ${layout.decisionY + 56}`}
        to={`135 ${layout.branchCardY - 2}`}
        variant={variant}
      />
      <PlaceholderEdge
        from={`250 ${layout.decisionY + 56}`}
        to={`385 ${layout.branchCardY - 2}`}
        variant={variant}
      />
      <EdgeLabel x={158} y={layout.branchLabelY} label="Ja" />
      <EdgeLabel x={348} y={layout.branchLabelY} label="Nein" />
      <PlaceholderCard
        x={20}
        y={layout.branchCardY}
        width={230}
        number={2}
        lines={[166, 118]}
      />
      <PlaceholderCard
        x={270}
        y={layout.branchCardY}
        width={230}
        number={3}
        lines={[154, 106]}
      />
      <PlaceholderEdge
        from={`135 ${layout.branchCardY + 92}`}
        to={`250 ${layout.endY - 44}`}
        variant={variant}
        showArrow={false}
      />
      <PlaceholderEdge
        from={`385 ${layout.branchCardY + 92}`}
        to={`250 ${layout.endY - 44}`}
        variant={variant}
        showArrow={false}
      />
      <PlaceholderEdge
        from={`250 ${layout.endY - 44}`}
        to={`250 ${layout.endY - 30}`}
        variant={variant}
      />

      <g className="fill-card stroke-foreground">
        <circle cx="250" cy={layout.endY} r="18" strokeWidth="4" />
        <text
          x="250"
          y={layout.endY + 36}
          textAnchor="middle"
          className="fill-muted-foreground text-[14px]"
        >
          Ende
        </text>
      </g>
    </svg>
  );
}

function PlaceholderCard({
  x,
  y,
  width = 320,
  number,
  lines,
}: {
  x: number;
  y: number;
  width?: number;
  number: number;
  lines: number[];
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height="92"
        rx="12"
        className="fill-card stroke-border"
        strokeWidth="1"
        strokeDasharray="5 4"
      />
      <circle cx={x + 34} cy={y + 30} r="10" className="fill-primary" />
      <text
        x={x + 34}
        y={y + 30}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-primary-foreground text-[11px] font-medium"
      >
        {number}
      </text>
      {lines.map((lineWidth, index) => (
        <rect
          key={lineWidth}
          x={x + 24}
          y={y + 50 + index * 18}
          width={lineWidth}
          height="8"
          rx="4"
          className="fill-muted"
        />
      ))}
    </g>
  );
}

function PlaceholderEdge({
  from,
  to,
  variant,
  showArrow = true,
}: {
  from: string;
  to: string;
  variant: "narrow" | "wide";
  showArrow?: boolean;
}) {
  const [x1, y1] = from.split(" ").map(Number);
  const [x2, y2] = to.split(" ").map(Number);
  const distance = Math.max(18, Math.abs(y2 - y1) / 2);
  const d =
    x1 === x2
      ? `M ${x1} ${y1} L ${x2} ${y2}`
      : `M ${x1} ${y1} C ${x1} ${y1 + distance} ${x2} ${y2 - distance} ${x2} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      className="stroke-muted-foreground"
      strokeWidth="1"
      strokeDasharray="5 4"
      markerEnd={
        showArrow
          ? `url(#process-flow-placeholder-arrow-${variant})`
          : undefined
      }
    />
  );
}

function EdgeLabel({ x, y, label }: { x: number; y: number; label: string }) {
  const width = label.length * 6.8 + 14;
  return (
    <g>
      <rect
        x={x - width / 2}
        y={y - 9}
        width={width}
        height="18"
        rx="4"
        className="fill-card"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground text-[12px]"
      >
        {label}
      </text>
    </g>
  );
}
