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
    prompt: >-
      Read the attached CSV and generate an inline Forge report from its real
      data. If no CSV is attached, ask for one and wait. Do not invent records.
```

The host passes normalized `starterTasks` to Forge. Clicking a task selects its
`agentId` through the host callback and fills the prompt; it does not automatically
send. Without an explicit `agentId`, Agently uses the publishing agent. The host
must expose the target agent and its needed tools/skills. Switching the agent does
not grant additional permissions.

A prompt asking for a file is not a client-side required-file validator. Users
attach the CSV before Send; if missing, the agent must request it rather than
inventing data. A separate Generate report starter can create an inline report
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

Agent/Model labels and reasoning controls remain host-configurable. Icon palette
and field styling should use CSS classes/tokens. The Agently host owns bottom
composer docking and chat/workspace transitions; do not apply chat sizing rules
to every Forge window.

Implementation: [Composer](../src/components/chat/Composer.jsx),
[CameraCapture](../src/components/chat/CameraCapture.jsx),
[camera lifecycle](../src/components/chat/cameraCapture.js).
