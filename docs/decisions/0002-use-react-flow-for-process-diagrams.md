# Use React Flow for Process Diagrams

Process Diagrams use the open-source `@xyflow/react` renderer. Chat Capture V1 supplies a deterministic horizontal layout of Process Step nodes and derived Transition edges; users may pan, zoom, focus references, and create contextual chat mentions, but they cannot drag, connect, delete, or directly edit diagram elements. This introduces a graph-capable rendering boundary now so later branching and loops do not require replacing the visualization layer.

## Considered Options

- Extending the existing custom CSS diagram would keep the V1 dependency set smaller but would require custom viewport, targeting, and future graph interaction behavior.
- React Flow already models custom nodes and edges, viewport controls, horizontal flows, and edge interaction while allowing the application to keep layout and editing disabled.

## Consequences

- The domain `ProcessUnderstanding` remains independent of React Flow types; a web adapter derives React Flow nodes and edges from validated domain JSON.
- V1 computes positions directly from the ordered linear steps and does not add a separate layout-engine dependency.
- Only open-source React Flow APIs and examples are used; React Flow Pro templates are not required.
