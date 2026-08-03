# Use one continuous Claude session per Chat Capture

Chat Capture uses one resumable Claude CLI session for the lifetime of a Process Capture. This preserves conversational context and enables provider-side prompt caching across document analysis, clarification, correction, and confirmation turns. Form Capture and other bounded AI operations retain their existing session behavior. The persisted transcript, uploaded documents, and Process Understanding files remain available for recovery; a resumed session is an execution optimization and must not be the only stored record of the capture.

## Considered Options

- A fresh Claude session for every message would make individual turns easier to reproduce and isolate, but would repeatedly rebuild the same document and conversation context.
- A continuous session reduces repeated context processing and better matches the intended conversational experience, at the cost of explicit session lifecycle and recovery handling.

## Consequences

- A Claude subprocess runs only for an active chat turn. Viewing the transcript or diagram does not resume the session.
- The model, system instructions, working directory, and tool set remain stable within a session so normal appended turns can reuse the server-side prompt cache.
- A cache expiry or invalidation makes the next turn slower because Claude must process the context again, but it does not prevent session resumption.
- V1 assumes one active chat client and one active turn per Process Capture. The active UI disables its composer while a turn runs; the backend does not add a distributed lock or queue, and concurrent tabs or clients are unsupported.
- The application retains its own transcript and last valid Process Understanding so it can replace an unavailable Claude session without losing the capture.
- Provider output is consumed to completion but is not forwarded verbatim to the browser. Claude can emit internal pre-tool narration that is unsuitable for the product UI. The server publishes only the successfully completed, application-persisted assistant reply; validated Process Understanding revisions continue to update the diagram while the turn runs.
