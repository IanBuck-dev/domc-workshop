# Define automatic Opportunity Discovery handoff

Type: grilling
Status: resolved
Blocked by: 03

## Question

How should normal confirmation and Confirmation Override atomically finalize Chat Capture, present the deterministic German thank-you state, trigger the existing two-phase Opportunity Discovery pipeline, expose background progress in process navigation and list status, and recover when the downstream job cannot be queued or later fails?

The decision must preserve the read-only confirmed chat, the potentially-incomplete marker, existing opportunity contracts, and permanent process deletion semantics.

## Answer

The durable confirmation boundary, normal/override outcomes, shared Opportunity Discovery service, start-failure recovery, UI state, source marker, and deletion order are specified in [Chat Capture V1 Implementation Plan](../../../docs/plans/chat-capture-v1.md#automatic-opportunity-discovery).
