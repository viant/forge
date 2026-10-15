import React from "react";
import { createRoot } from "react-dom/client";
import WindowYamlEditor from "./WindowYamlEditor";
import { loadBundleCanonicalizer } from "./bundleCanonical";
import { readDocument, rekeyBundle } from "./windowDocument";
import { sample } from "./demoSample";
async function start() {
  await loadBundleCanonicalizer();
  const sampleDocument = readDocument(sample).document;
  rekeyBundle(sampleDocument);
  createRoot(document.getElementById("root")).render(
    <WindowYamlEditor defaultValue={sampleDocument.toString({lineWidth: 0})} title="Window editor" />
  );
}
start().catch((error) => { document.getElementById("root").textContent = error.message; });
