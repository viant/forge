# Chat composer and starter tasks

Forge's `Chat` integrates a composer with host-provided agent/model choices,
attachment upload, and optional camera capture. Host conversation projections
own progress and execution-detail visibility; those are not CSS theme features.

## Starter task agent selection

Agently agent metadata can declare a task's target agent independently of the
agent that publishes the task:

```yaml
starterTasks:
  - id: analyze-csv-report
    agentId: coder
    title: Analyze CSV and build report
    description: Attach a CSV before sending this task.
    resultLabel: Inline report
    prompt: >-
      $forge-report-authoring Read the attached CSV and generate an inline Forge report from its real
      data. If no CSV is attached, ask for one and wait. Do not invent records.
```

The host passes normalized `starterTasks` to Forge. Clicking a task selects its
`agentId` through the host callback and fills the prompt; it does not automatically
send. Starting the prompt with `$forge-report-authoring` activates that installed
Agently skill directly; merely mentioning its name in prose does not. Without an explicit `agentId`, Agently uses the publishing agent. The host
must expose the target agent and its needed tools/skills. Switching the agent does
not grant additional permissions.

`resultLabel` is an optional short outcome caption from host task metadata.
Document task rows display it with the caption role and include it in library
search. It describes presentation only; it does not guarantee that sending the
prompt will create or save an output. Omission removes the caption.

A prompt asking for a file is not a client-side required-file validator. Users
attach the CSV before Send; if missing, the agent must request it rather than
inventing data. The Agently backend preserves UTF-8 CSV and other declared text
attachments as text content for text-only models; images and other binary media
still require the corresponding model capability. An upload chip alone does not
prove the model received the file contents. A separate Generate report starter can create an inline report
from conversation data without any configured workspace report. See
[inline reporting](reporting.md#inline-report-transactions).

## File picker versus camera

The image/file action calls the host's `onOpenAttach` flow. Camera opens a live
webcam dialog using `navigator.mediaDevices.getUserMedia` with video only. It is
not an `<input capture>` file picker (desktop browsers commonly ignore that hint).

Camera access starts only after the user activates Camera. The dialog supports
preview, Capture photo, Cancel, permission/unavailable errors, and retry. Capturing
creates a JPEG `File`, delivered through `onCaptureImage` to the existing upload
pipeline. Cancellation/unmount stops tracks; late permission or encoding results
cannot attach a photo after cancellation. A supported browser, camera, secure
context (including localhost), and camera permission are required. Merely adding
the component does not grant permission.

Document Composer also accepts files dropped over its message field or toolbar
when `showUpload` is enabled, `disabled` is false and `onDropFiles` is supplied.
The callback receives the native Files as one array. Chat passes that array to
its existing upload preparation and upload service, without sending the draft
or opening the picker. The shared surface shows “Drop files to upload” while
files are over it, including movement between its children, and clears on leave,
drop or drag end. Unavailable file drops cannot navigate the browser away from
the draft. Ordinary text dragging retains native behavior. The existing picker
remains the keyboard and touch alternative; no folder traversal or file policy
is added. FoundationSpecimen demonstrates local multiple-file drops and the
disabled state, with checks in the existing workspace-theme runner.

The legacy Attach files dialog accepts drops into its chooser or selection body too.
These append to its existing selection, deduplicating exact files across picker
and drop, and wait for Upload. Its native Browse files control remains available
by mouse, keyboard and touch. Both surfaces share useFileDrop; the modal stages
files while the document chat box invokes the existing upload flow directly.

Agent/Model labels and reasoning controls remain host-configurable. Icon palette
and field styling should use CSS classes/tokens. The Agently host owns bottom
composer docking and chat/workspace transitions; do not apply chat sizing rules
to every Forge window.

Implementation: [Composer](../src/components/chat/Composer.jsx),
[CameraCapture](../src/components/chat/CameraCapture.jsx),
[camera lifecycle](../src/components/chat/cameraCapture.js).

## Skill autocomplete in the Agently host

The Agently chat input offers `$` hints alongside `/` lookups. A leading `$`
opens the installed skills visible to the selected agent; matching names and
short descriptions are listed. Arrow keys navigate, Enter/Tab insert the prefix,
and Escape dismisses. Picking an entry never sends or activates a skill by itself.
Mid-sentence dollar signs do not trigger skill activation hints.

Hosts can list skills before creating a conversation with
`GET /v1/skills?agentId=coder`, or use `conversationId` for the conversation's
agent. When both are supplied, the explicitly selected agent determines the list.
Go, TypeScript, iOS and Android SDKs expose this optional agent scope. The
TypeScript SDK provides `listSkills` and `activateSkill`; autocomplete uses only
the read-only list operation. Forge does not load skill instructions itself.

## Document presentation

Select `chat.appearance: document` in native window metadata to use the shared
`DocumentComposer` and `StarterTaskBrowser`. Omission retains the existing chat.
This optional property is validated by the window-editor schema and serialized
by the native Go loader. It is a renderer capability, with no product palette,
font, task catalog or business decisions in Forge.

The same Composer state and handlers serve both presentations. Document mode
places the message field above an internal toolbar with Uploads, Tools, microphone,
Send and a separate Stop action. Tools groups the existing agent/model/reasoning,
auto-tool, toolset and settings callbacks. Camera uses the existing capture and
upload lifecycle. Queued turns keep Steer, remove, move and edit callbacks.
A shared SelectControl supplies selector anatomy and chevron spacing.

The message field grows to 200px, recalculates on text and width changes and when
the current font-loading promise resolves, then scrolls. Enter sends, Shift+Enter
adds a newline, and IME composition cannot send. A blank draft without attachments
or lookup-invalid input cannot send. Escape closes a disclosure and returns
focus to its trigger. Pointer focus remains quiet, keyboard focus visible, and
phone actions retain 44px targets. Body/label/metadata roles supply all five type
properties; the documented 16px phone text-input exception avoids browser zoom.

`Chat` keeps Home, task and conversation drafts in the existing per-session draft
store, retaining whitespace and intentionally empty drafts. Task selection fills
an editable prompt and never sends it. `starter` and `starterFrom` URL parameters
record only bounded task identity and library source, not prompt content. Browser
history restores that selection. Task Back and refresh preserve exact drafts;
explicit New Chat retains Agently's existing blank-draft reset and clears the
prepared-task location. Host macro resolution remains in the host.
The browser renders every authored task and category from host metadata, with
counts and a suggested task from each category. Library search matches title,
description, outcome label and category name. Browse all and the library's
New Chat return clear the category/search filters; Show all tasks clears them
and focuses search.
Returning from a prepared task retains the mounted browser's category/search.

The existing Agently typography specimen renders these actual components and
message consumers. Forge's existing `test:workspace-theme` command includes the
six document-chat component tests, including real queue callbacks and a source
check rejecting product branding, numeric typography and raw-color bypasses.
The host browser checks verify desktop/touch interactions and perturb all five
body-role properties on real message content. These checks do not certify a
live model request, microphone/camera hardware or business-report persistence.

### Home, library and recent composition

The actual `Chat` component owns document Home composition: a display-role
question, the real composer, then the task browser. The host may supply
`renderHomeRecent` through its external composer props; Chat places that slot
after the task browser. Agently uses it for real recent-conversation links and
owns their loading, empty, error and reopening behavior. Forge does not fetch
or fabricate conversation history.

Library mode is shared state between Chat and StarterTaskBrowser. It hides the
Home question, composer and recent slot while showing the grouped library and
search. Returning restores the Home composition. A prepared task hides the
mounted browser and recent slot while preserving its category/search state;
Back restores that state and the editable draft. These are actual application
components, not a proof-only page.

Task titles use label, descriptions use small, and optional outcome captions use
caption. Every category control, including Suggested or All tasks, uses small;
Browse and the library return action also use small. Counts inherit that role.
All five properties come from the selected role. Workspace metadata may supply
`inputProps.placeholder` through the host input component; the existing default
remains when omitted.

The native Chat Home in Agently's existing ChatSpecimen verifies that even a
short task list keeps the composer 25px below the question and before the task
browser. The existing desktop/touch browser runner also checks small-role
markers on category controls and changes all five small-role properties on
categories/descriptions, alongside the real message body-role checks. Shared
geometry keeps the microphone and send controls aligned: desktop send is 36px;
phone/coarse-pointer send and microphone retain 44px targets with a 6px gap.
The idle send surface consumes the workspace disabled-background role.

### Conversation frame and host outputs

The same document Chat supplies the frame around a conversation with an open
output. Its feed uses a 680px maximum measure with 32px 24px 24px padding; the
composer uses a 728px maximum frame with 8px 16px 16px padding. At 760px and below,
feed padding becomes 24px 20px and composer padding becomes 8px 12px 12px. Home
retains its separate composition. These shared geometry rules stay in
`documentChat.css`; workspace CSS selects semantic values rather than copying
the layout.

Agently owns output admission, reply links, tabs, inventory and lifecycle. Its
maintained `OutputHandoffSpecimen` mounts actual Chat feed and workspace components
with the existing report reader. Existing component and desktop/touch browser
checks cover the frame and semantic roles alongside Home regression. This frame
does not migrate report bodies or prove report saving, permission recovery or
cross-device retention. Brand colors, font assets and product copy remain
workspace-owned.


### Document chat file selection and upload feedback

Document Chat opens the native picker directly from Add photos or files. Dropping
or picking starts the same upload flow without an intermediate modal or Upload
confirmation. Camera keeps its explicit capture preview. Legacy Chat retains its
existing dialog contract.

UploadChips shows each selected file immediately, including async preparation,
transfer progress and the final response wait. Cancel removes a pending file;
late results cannot restore it. Failed files stay visible with Retry/remove and
are excluded from the message payload. Send stays blocked until each unresolved
file finishes or is removed, while the draft remains editable. Ready attachments
continue through the existing payload and removal handlers. The specimen uses
independent files and an explicit stage control; it executes no real upload.

Upload and ready states share the same keyed attachment card, width and reserved
progress space, so completion only changes the status. File order remains stable
when responses arrive out of order. Ready removal uses the original attachment
index and internal upload identity is excluded from serialized message fields.
