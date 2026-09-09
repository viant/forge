import React from "react";

export default function ReportBuilderOptionControls({ definitions = [], values = {}, onChange = null, onReset = null, activeCount = 0, headingId = "report-builder-options-heading" }) {
  if (!Array.isArray(definitions) || definitions.length === 0) return null;
  return (
    <section className="forge-report-builder__report-options" aria-labelledby={headingId}>
      <div className="forge-report-builder__bottom-header">
        <div>
          <h3 id={headingId} className="forge-report-builder__bottom-label forge-report-builder__bottom-label--featured">Report options</h3>
          <div className="forge-report-builder__bottom-description">Adjust server-published report semantics.</div>
        </div>
        {activeCount > 0 && typeof onReset === "function" ? (
          <button type="button" className="forge-report-builder__bottom-toggle" aria-label="Reset report options to defaults" onClick={onReset}>
            Reset to defaults
          </button>
        ) : null}
      </div>
      <div className="forge-report-builder__report-options-grid">
        {definitions.map((definition) => {
          const inputId = `report-builder-option-${definition.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
          const descriptionId = definition.description ? `${inputId}-description` : undefined;
          const value = values?.[definition.name];
          return (
            <div className="forge-report-builder__report-option" key={definition.name}>
              <label htmlFor={inputId}>{definition.label}</label>
              {definition.type === "boolean" ? (
                <input
                  id={inputId}
                  type="checkbox"
                  checked={value === true}
                  aria-describedby={descriptionId}
                  onChange={(event) => onChange?.(definition.name, event.target.checked)}
                />
              ) : definition.values.length > 0 ? (
                <select
                  id={inputId}
                  value={value ?? ""}
                  aria-describedby={descriptionId}
                  onChange={(event) => onChange?.(definition.name, event.target.value)}
                >
                  {definition.values.map((entry) => (
                    <option key={`${typeof entry.value}:${String(entry.value)}`} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={inputId}
                  type={definition.type === "integer" || definition.type === "number" ? "number" : "text"}
                  step={definition.type === "integer" ? "1" : undefined}
                  value={value ?? ""}
                  aria-describedby={descriptionId}
                  onChange={(event) => onChange?.(definition.name, event.target.value)}
                />
              )}
              {definition.description ? <div id={descriptionId} className="forge-report-builder__report-option-description">{definition.description}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
