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

**Form Capture**:
The alternative Interaction Mode in which a person supplies process information through structured fields before reviewing the Process Understanding.
_Avoid_: Classic mode, manual mode

**Process Understanding**:
The structured, evidence-aware description of the current process that a person ultimately confirms. It includes the ordered process steps and the known inputs, outputs, information, decisions, assumptions, and gaps.
_Avoid_: AI result, assessment result

**Process Diagram**:
The visual representation of the ordered process steps contained in the Process Understanding. In the initial version it represents a linear flow only.
_Avoid_: Workflow automation, solution architecture

**Process Step**:
One ordered activity in the current process. A Process Step is the primary visible element of the initial Process Diagram.
_Avoid_: Form section, criterion

**Transition**:
The connection from one Process Step to the next in the current process. In the initial linear Process Diagram, every Transition connects two adjacent Process Steps.
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
