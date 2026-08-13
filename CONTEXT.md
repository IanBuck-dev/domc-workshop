# Process Capture and KI Potential Discovery

This context describes how current business processes are captured, confirmed, and later used to discover evidence-backed KI potential.

## Language

**Process Capture**:
The activity through which a department describes and confirms how a business process works today.
_Avoid_: Assessment, process evaluation

**Interaction Mode**:
The capture experience selected when a Process Capture starts. The available modes are Chat Capture and Form Capture.
_Avoid_: Assessment mode, input type

**Chat Capture**:
The primary Interaction Mode in which a person supplies documents and corrections while an assistant builds and refines the Process Understanding.
_Avoid_: Chat assessment, interview

**Chat Activity**:
A short, transient, user-facing progress state shown while a Chat Capture turn is running. It describes the current kind of work without exposing model reasoning, prompts, tool arguments, file paths, terminal output, or other runtime internals.
_Avoid_: Chain of thought, reasoning log, tool log

**Form Capture**:
The alternative Interaction Mode in which a person supplies process information through structured fields before reviewing the Process Understanding.
_Avoid_: Classic mode, manual mode

**Process Record**:
The single domain aggregate for one captured process. It owns the raw capture material, the Process Understanding, the Process Diagram, fixed PDD fields, provenance, confirmation, and validation state. These parts may be persisted in multiple atomic files but form one process object in the domain.
_Avoid_: PDD Definition as a separate record, Excel as process storage

**Process Understanding**:
The structured, evidence-aware current-state description within a Process Record that a person ultimately confirms. It includes the ordered process steps and the known inputs, outputs, information, decisions, assumptions, and gaps.
_Avoid_: AI result, assessment result

**Process Diagram**:
The visual representation of the ordered process steps contained in the Process Understanding. In the initial version it represents a linear flow only.
_Avoid_: Workflow automation, solution architecture

**Process Tracker**:
The compact, sticky overview of the Process Diagram shown beside a Chat Capture in its default desktop layout. It provides orientation and expands into the full Process Diagram workspace; it is not a separate process artifact.
_Avoid_: Sidebar, mini diagram, second Process Diagram

**Process Step**:
One ordered activity in the current process. A Process Step is the primary visible element of the initial Process Diagram.
_Avoid_: Form section, criterion

**Process Actor**:
A department, role, or external party involved in a Process Step, together with how it participates. Process Actors identify organizational responsibility without naming individual people.
_Avoid_: Workshop participant, user account

**Process Variation**:
A confirmed difference in current handling. A Flow Branch represents a variation that changes the path, step order, or outcome; a Step Exception represents a smaller variation that leaves the main sequence intact and is attached to the affected Process Steps.
_Avoid_: Optimization idea, future scenario

**Transition**:
The connection from one Process Step to the next in the current process. A Transition may describe a confirmed responsibility or information handoff, including its channel and whether a media break occurs.
_Avoid_: Vertex, workflow branch

**Process Confirmation**:
The explicit human action that approves the current Process Understanding as an adequate representation of the process.
_Avoid_: AI confirmation, automatic approval

**Confirmation Override**:
A Process Confirmation made while material gaps or unresolved conflicts remain. The Process Understanding is approved for continued use but remains visibly marked as potentially incomplete.
_Avoid_: Forced completion, ignored warning

**Opportunity Discovery**:
The downstream analysis that derives evidence-backed KI-potential hypotheses and three human-oversight scenarios from a confirmed Process Understanding.
_Avoid_: Process Capture, solution assessment, project scoring

**PDD Export**:
A deterministic, read-only Excel Process Definition Document derived from the confirmed fields of one Process Record. It preserves the confirmed source revision, provenance, assumptions, open points, and evidence; it is never imported back.
_Avoid_: Editable process document, template editor, process assessment

**Agentic Potential Assessment**:
The advisory, immutable criteria assessment of the completed `SCN-agentic` scenario. It is created by one bounded AI call; its web review and Excel export are deterministic views of the saved result.
_Avoid_: Process assessment, solution approval, prioritisation
