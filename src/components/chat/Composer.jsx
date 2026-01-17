// Composer.jsx – TextArea prompt with send/upload/tools controls
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Menu, MenuDivider, MenuItem, Popover, Tag, TextArea, Tooltip } from "@blueprintjs/core";
import { PaperPlaneRight, StopCircle, Microphone, MicrophoneSlash, ListBullets, UserCircle, Lightbulb } from '@phosphor-icons/react';
import BundlesDialog from "./BundlesDialog.jsx";

function composerMaxHeightPx(maxRows, paddingTopPx) {
    const safeRows = Math.max(1, Number(maxRows) || 1);
    const safePad = Math.max(0, Number(paddingTopPx) || 0);
    const estimatedLineHeightPx = 20; // close enough; Blueprint will compute exact height
    return (safeRows * estimatedLineHeightPx) + safePad + 16;
}

export default function Composer({
    tools = [],
    toolOptions,
    selectedTools: selectedToolsProp,
	    onToolsChange,
	    autoSelectTools = false,
	    onAutoSelectToolsChange,
	    agentOptions,
	    agentValue,
	    onAgentChange,
    modelOptions,
    modelInfo,
    modelValue,
    onModelChange,
    reasoningOptions,
    reasoningValue,
    onReasoningChange,
    activeChips = [],
    onChipClick,
    onChipClear,
    commandCenter = false,
    submitMode,
    submitLabel,
    queueCount,
    queuedTurns,
    usageSummary,
    usageTooltip,
    onQueueCancel,
    onQueueMove,
    onSubmit,
    onOpenAttach,
    onOpenSettings,
    onAbort,
    showTools = false,
    showUpload = false,
    showSettings = false,
    showAbort = false,
    uploadTooltip = 'upload',
    settingsTooltip,
    sendTooltip,
    abortTooltip,
    showMic = false,
    micTooltip,
    micOn: micOnProp,
    defaultMicOn = false,
    onToggleMic,
    onCaptureAudio,
    disabled = false,
    attachments = [],
    onRemoveAttachment,
    autoResize = true,
	maxRows = 10,
	}) {
	const [draft, setDraft] = useState("");
	const [selectedToolsInternal, setSelectedToolsInternal] = useState([]);
	const selectedTools = (selectedToolsProp !== undefined) ? selectedToolsProp : selectedToolsInternal;
	const [micOnInternal, setMicOnInternal] = useState(!!defaultMicOn);
	const [agentOpen, setAgentOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [reasoningOpen, setReasoningOpen] = useState(false);
	const [queueOpen, setQueueOpen] = useState(false);
		const [bundlesOpen, setBundlesOpen] = useState(false);
		const [bundlesMenuOpen, setBundlesMenuOpen] = useState(false);
	const micOn = (micOnProp !== undefined) ? !!micOnProp : micOnInternal;
	const recognitionRef = useRef(null);
	const recognitionRestartRef = useRef(false);
	const dictationBaseRef = useRef('');
	const dictationFinalRef = useRef('');
	const mediaRecorderRef = useRef(null);
	const mediaStreamRef = useRef(null);
	const mediaChunksRef = useRef([]);
	const recordingStartTsRef = useRef(0);
	const lastManualAgentRef = useRef('');

	const setMicEnabled = (enabled) => {
	    const next = !!enabled;
	    if (micOnProp === undefined) setMicOnInternal(next);
	    onToggleMic?.(next);
	};

		const toggleMic = () => setMicEnabled(!micOn);

	    useEffect(() => {
	        if (!autoSelectTools) return;
	        setBundlesOpen(false);
	    }, [autoSelectTools]);

	const getSpeechRecognitionCtor = () => {
	    try {
	        if (typeof window === 'undefined') return null;
	        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
	    } catch (_) {
	        return null;
	    }
	};

	const ensureRecognition = () => {
	    const existing = recognitionRef.current;
	    if (existing) return existing;
	    const Ctor = getSpeechRecognitionCtor();
	    if (!Ctor) return null;
	    const rec = new Ctor();
	    rec.continuous = true;
	    rec.interimResults = true;
	    rec.maxAlternatives = 1;
	    recognitionRef.current = rec;
	    return rec;
	};

	const startDictation = () => {
	    const rec = ensureRecognition();
	    if (!rec) return false;
	    dictationBaseRef.current = String(draft || '');
	    dictationFinalRef.current = '';
	    recognitionRestartRef.current = true;
	    try { rec.start(); } catch (_) {}
	    return true;
	};

	const stopDictation = () => {
	    recognitionRestartRef.current = false;
	    const rec = recognitionRef.current;
	    if (!rec) return;
	    try { rec.stop(); } catch (_) {}
	};

	const canRecordAudio = () => {
	    try {
	        if (typeof window === 'undefined') return false;
	        if (typeof window.MediaRecorder === 'undefined') return false;
	        return !!(navigator?.mediaDevices?.getUserMedia);
	    } catch (_) {
	        return false;
	    }
	};

	const preferredAudioMimeType = () => {
	    if (!canRecordAudio()) return '';
	    const isSupported = (type) => {
	        try { return typeof window.MediaRecorder.isTypeSupported === 'function' && window.MediaRecorder.isTypeSupported(type); } catch (_) { return false; }
	    };
	    const candidates = [
	        'audio/webm;codecs=opus',
	        'audio/webm',
	        'audio/ogg;codecs=opus',
	        'audio/ogg',
	        'audio/mp4',
	    ];
	    for (const type of candidates) {
	        if (isSupported(type)) return type;
	    }
	    return '';
	};

	const stopRecordingStream = () => {
	    const stream = mediaStreamRef.current;
	    mediaStreamRef.current = null;
	    if (!stream) return;
	    try {
	        const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
	        tracks.forEach(t => {
	            try { t.stop(); } catch (_) {}
	        });
	    } catch (_) {}
	};

	const stopRecording = () => {
	    const rec = mediaRecorderRef.current;
	    if (!rec) {
	        stopRecordingStream();
	        return;
	    }
	    try {
	        if (rec.state !== 'inactive') rec.stop();
	    } catch (_) {
	        mediaRecorderRef.current = null;
	        stopRecordingStream();
	    }
	};

	const startRecording = async () => {
	    if (!canRecordAudio()) return false;
	    if (mediaRecorderRef.current) return true;
	    let stream = null;
	    try {
	        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	    } catch (_) {
	        return false;
	    }
	    if (!stream) return false;
	    mediaStreamRef.current = stream;

	    const mimeType = preferredAudioMimeType();
	    let recorder = null;
	    try {
	        recorder = mimeType ? new window.MediaRecorder(stream, { mimeType }) : new window.MediaRecorder(stream);
	    } catch (_) {
	        stopRecordingStream();
	        return false;
	    }

	    mediaRecorderRef.current = recorder;
	    mediaChunksRef.current = [];
	    recordingStartTsRef.current = Date.now();

	    recorder.ondataavailable = (event) => {
	        try {
	            if (event?.data && event.data.size > 0) mediaChunksRef.current.push(event.data);
	        } catch (_) {}
	    };

	    recorder.onerror = () => {
	        try { stopRecording(); } catch (_) {}
	        // If dictation is available, keep the mic enabled as "dictation-only".
	        const hasDictation = !!getSpeechRecognitionCtor();
	        if (!hasDictation) setMicEnabled(false);
	    };

	    recorder.onstop = () => {
	        const chunks = Array.isArray(mediaChunksRef.current) ? mediaChunksRef.current : [];
	        const type = String(recorder.mimeType || mimeType || 'audio/webm');
	        const blob = new Blob(chunks, { type });
	        mediaChunksRef.current = [];
	        mediaRecorderRef.current = null;
	        stopRecordingStream();

	        if (!blob || blob.size === 0) return;
	        const ext = (() => {
	            if (type.includes('ogg')) return 'ogg';
	            if (type.includes('mp4')) return 'mp4';
	            return 'webm';
	        })();
	        const ts = new Date(recordingStartTsRef.current || Date.now());
	        const safeStamp = ts.toISOString().replaceAll(':', '-').replaceAll('.', '-');
	        const name = `voice-${safeStamp}.${ext}`;
	        try {
	            const file = new File([blob], name, { type });
	            (async () => {
	                const transcript = await transcribeAudioFile(file);
	                if (transcript) {
	                    setDraft((prev) => {
	                        const base = String(prev || '').trim();
	                        const sep = base ? ' ' : '';
	                        return `${base}${sep}${transcript}`.trim();
	                    });
	                    return;
	                }
	                onCaptureAudio?.(file);
	            })();
	        } catch (_) {}
	    };

	    try {
	        recorder.start(250);
	    } catch (_) {
	        mediaRecorderRef.current = null;
	        stopRecordingStream();
	        return false;
	    }

	    return true;
	};

	const resolveAPIBaseURL = () => {
	    try {
	        const raw = (typeof process !== 'undefined' && process?.env) ? process.env.DATA_URL : '';
	        const value = String(raw || '').trim();
	        if (!value || value === '/') return '';
	        return value.replace(/\/+$/, '');
	    } catch (_) {
	        return '';
	    }
	};

	const transcribeAudioFile = async (file) => {
	    if (!file) return '';
	    let response;
	    try {
	        const base = resolveAPIBaseURL();
	        const url = `${base}/v1/api/speech/transcribe`;
	        const form = new FormData();
	        form.append('file', file, file.name);
	        response = await fetch(url, { method: 'POST', body: form, credentials: 'include' });
	    } catch (_) {
	        return '';
	    }
	    if (!response || !response.ok) return '';
	    try {
	        const data = await response.json();
	        return String(data?.text || '').trim();
	    } catch (_) {
	        return '';
	    }
	};

	useEffect(() => {
	    if (!showMic) return;
	    const rec = ensureRecognition();
	    if (!rec) return;

	    rec.onresult = (event) => {
	        try {
	            let interim = '';
	            for (let i = event.resultIndex; i < event.results.length; i++) {
	                const res = event.results[i];
	                const text = String(res?.[0]?.transcript || '').trim();
	                if (!text) continue;
	                if (res.isFinal) {
	                    dictationFinalRef.current = (dictationFinalRef.current ? `${dictationFinalRef.current} ` : '') + text;
	                } else {
	                    interim = (interim ? `${interim} ` : '') + text;
	                }
	            }
	            const base = String(dictationBaseRef.current || '').trim();
	            const finalText = String(dictationFinalRef.current || '').trim();
	            const parts = [base, finalText, interim].filter(Boolean);
	            setDraft(parts.join(' ').trim());
	        } catch (_) {}
	    };

	    rec.onerror = () => {
	        recognitionRestartRef.current = false;
	        // If we're recording audio, keep the mic "on" and just stop dictation.
	        const recorder = mediaRecorderRef.current;
	        const isRecording = !!recorder && String(recorder.state || '').toLowerCase() === 'recording';
	        if (!isRecording) {
	            setMicEnabled(false);
	        }
	    };

	    rec.onend = () => {
	        if (!recognitionRestartRef.current) return;
	        try { rec.start(); } catch (_) {}
	    };

	    return () => {
	        rec.onresult = null;
	        rec.onerror = null;
	        rec.onend = null;
	    };
	    // eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showMic, micOnProp]);

	useEffect(() => {
	    if (!showMic) return;
	    if (disabled) {
	        if (micOn) setMicEnabled(false);
	        return;
	    }
	    let cancelled = false;
	    const start = async () => {
	        const startedDictation = startDictation();
	        if (startedDictation) return;

	        const startedRecording = await startRecording();
	        if (cancelled) {
	            if (startedRecording) stopRecording();
	            return;
	        }
	        if (!startedRecording) {
	            setMicEnabled(false);
	        }
	    };

	    if (micOn) {
	        start();
	    } else {
	        stopRecording();
	        stopDictation();
	    }

	    return () => {
	        cancelled = true;
	    };
	    // eslint-disable-next-line react-hooks/exhaustive-deps
	}, [micOn, showMic, disabled]);

	useEffect(() => {
	    return () => {
	        try { stopRecording(); } catch (_) {}
	        try { stopDictation(); } catch (_) {}
	        try { stopRecordingStream(); } catch (_) {}
	        recognitionRef.current = null;
	    };
	    // eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (disabled) return; // Block submission while disabled
        if (!draft.trim()) return;
        onSubmit?.({ content: draft, toolNames: selectedTools });
        setDraft("");
    };

    const handleAbort = (e) => {
        e.preventDefault();
        onAbort?.();
    };

    // Reflect global loading lock by disabling the action controls and showing a spinner
    const actionDisabled = disabled;
    const effectiveSubmitMode = String(submitMode || '').trim().toLowerCase();
    const isQueueMode = effectiveSubmitMode === 'queue';
    const submitText = String(submitLabel || (isQueueMode ? 'Queue' : 'Send'));
    const showAbortButton = !!showAbort;
    const terminateOverridesSubmit = showAbortButton && !commandCenter;
    const submitIconEl = isQueueMode ? (
        <ListBullets size={18} weight="fill" />
    ) : (
        <PaperPlaneRight size={18} weight="fill" />
    );
    const abortIconEl = <StopCircle size={18} weight="fill" />;

    const hasToolsPicker = Array.isArray(toolOptions) ? toolOptions.length > 0 : Array.isArray(tools) && tools.length > 0;
    const effectiveToolOptions = Array.isArray(toolOptions)
        ? toolOptions
        : (Array.isArray(tools) ? tools.map(t => ({ value: String(t), label: String(t) })) : []);

	const withTooltip = (node, content) => content ? (
	    <Tooltip content={content} hoverOpenDelay={250}>{node}</Tooltip>
	) : node;

	const normalizedAgentOptions = useMemo(() => {
	    const list = Array.isArray(agentOptions) ? agentOptions : [];
	    return list.map((opt) => ({
	        ...opt,
	        label: String(opt?.label ?? opt?.name ?? opt?.title ?? opt?.value ?? opt?.id ?? ''),
	    }));
	}, [agentOptions]);

	const normalizedModelOptions = useMemo(() => {
	    const list = Array.isArray(modelOptions) ? modelOptions : [];
	    return list.map((opt) => ({
	        ...opt,
	        // Prefer explicit option labels; when options are auto-derived with label=value,
	        // use workspace `modelInfo[modelId].name` if available.
	        label: (() => {
	            const value = String(opt?.value ?? opt?.id ?? '').trim();
	            const rawLabel = String(opt?.label ?? opt?.name ?? opt?.title ?? '').trim();
	            const infoLabel = (modelInfo && value && modelInfo?.[value]?.name)
	                ? String(modelInfo[value].name).trim()
	                : '';
	            if (infoLabel && (!rawLabel || rawLabel === value)) return infoLabel;
	            return rawLabel || value;
	        })(),
	    }));
	}, [
	    // Some Forge contexts may mutate option arrays in-place; derive a stable signature
	    // so the memo recomputes when option content changes.
	    Array.isArray(modelOptions)
	        ? modelOptions.map((o) => `${String(o?.value ?? o?.id ?? '').trim()}:${String(o?.label ?? o?.name ?? o?.title ?? '').trim()}`).join('|')
	        : '',
	    modelInfo,
	]);

	const normalizeString = (value) => String(value || '').trim();
	const bundleIdFromTool = (toolOptionOrValue) => {
	    const explicit = toolOptionOrValue && typeof toolOptionOrValue === 'object'
	        ? (toolOptionOrValue.bundle || toolOptionOrValue.toolset || toolOptionOrValue.connector)
	        : '';
	    const explicitKey = normalizeString(explicit);
	    if (explicitKey) return explicitKey;

	    const raw = normalizeString(
	        (toolOptionOrValue && typeof toolOptionOrValue === 'object')
	            ? (toolOptionOrValue.value ?? toolOptionOrValue.id)
	            : toolOptionOrValue
	    );
	    if (!raw) return '';
	    // Tool names are primarily "service:method". Preserve service IDs containing '/' (e.g. system/exec).
	    if (raw.includes(':')) return raw.split(':')[0];
	    // Some tool names are expressed as "service/tool" (e.g. agentExec/coder). In that case the bundle is the service prefix.
	    if (raw.includes('/')) return raw.split('/')[0];
	    if (raw.includes('.')) return raw.split('.')[0];
	    return raw;
	};

	const bundleLabelFromId = (bundleID) => {
	    const id = normalizeString(bundleID);
	    if (!id) return '';
	    const key = id.toLowerCase();
	    const special = {
	        llm: 'LLM',
	        mcp: 'MCP',
	        api: 'API',
	        ui: 'UI',
	        db: 'DB',
	        webdriver: 'WebDriver',
	        agentexec: 'Agent Exec',
	    };
	    if (special[key]) return special[key];

	    const spaced = id
	        .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
	        .replaceAll(/[\\/_-]+/g, ' ')
	        .trim();
	    if (!spaced) return id;

	    return spaced
	        .split(/\s+/g)
	        .filter(Boolean)
	        .map((w) => {
	            const word = String(w);
	            const lower = word.toLowerCase();
	            if (lower === word && word.length <= 4) return word.toUpperCase();
	            return lower.charAt(0).toUpperCase() + lower.slice(1);
	        })
	        .join(' ');
	};

	const buildBundleCatalog = (options) => {
	    const toolToBundle = new Map();
	    const bundleToTools = new Map();
	    const bundleToLabel = new Map();

	    const opts = Array.isArray(options) ? options : [];
	    for (const opt of opts) {
	        const toolValue = normalizeString(opt?.value ?? opt?.id);
	        if (!toolValue) continue;
	        const bundleID = bundleIdFromTool(opt) || bundleIdFromTool(toolValue);
	        if (!bundleID) continue;
	        toolToBundle.set(toolValue, bundleID);
	        if (!bundleToTools.has(bundleID)) bundleToTools.set(bundleID, []);
	        bundleToTools.get(bundleID).push(toolValue);
	        const label = normalizeString(opt?.bundleLabel ?? opt?.toolsetLabel ?? opt?.connectorLabel) || bundleLabelFromId(bundleID);
	        if (!bundleToLabel.has(bundleID)) bundleToLabel.set(bundleID, label);
	    }

	    const bundles = Array.from(bundleToTools.entries()).map(([id, tools]) => {
	        const label = bundleToLabel.get(id) || bundleLabelFromId(id) || id;
	        const iconText = label ? label.charAt(0).toUpperCase() : id.charAt(0).toUpperCase();
	        return { id, label, iconText, tools };
	    }).sort((a, b) => a.label.localeCompare(b.label));

	    const byId = new Map(bundles.map(b => [b.id, b]));
	    return { bundles, byId, toolToBundle };
	};

	const bundleCatalog = useMemo(() => buildBundleCatalog(effectiveToolOptions), [JSON.stringify(effectiveToolOptions || [])]);
	const selectedBundleIDs = useMemo(() => {
	    const ids = new Set();
	    for (const toolName of (Array.isArray(selectedTools) ? selectedTools : [])) {
	        const tool = normalizeString(toolName);
	        if (!tool) continue;
	        const bundleID = bundleCatalog.toolToBundle.get(tool) || bundleIdFromTool(tool);
	        if (bundleID) ids.add(bundleID);
	    }
	    const ordered = bundleCatalog.bundles.map(b => b.id).filter(id => ids.has(id));
	    const missing = Array.from(ids).filter(id => !ordered.includes(id));
	    return [...ordered, ...missing];
	}, [bundleCatalog, JSON.stringify(selectedTools || [])]);

	const optionLabel = (options, currentValue) => {
	    const current = normalizeString(currentValue);
	    if (!current) return '—';
	    const list = Array.isArray(options) ? options : [];
	    const match = list.find((opt) => normalizeString(opt?.value ?? opt?.id) === current);
	    return normalizeString(match?.label) || current;
	};

	const visibleChips = (() => {
	    const chips = Array.isArray(activeChips) ? activeChips : [];
	    const hidden = new Set(['tools', 'agent', 'model', 'reasoningEffort']);
	    return chips.filter(c => !hidden.has(String(c?.id || '')));
	})();

	const updateSelectedTools = (next) => {
	    const normalized = Array.isArray(next) ? next : [];
	    if (selectedToolsProp === undefined) setSelectedToolsInternal(normalized);
	    onToolsChange?.(normalized);
	};

		const optionMenu = (options, currentValue, onChange, close) => (
		    <Menu>
		        {(Array.isArray(options) ? options : []).map((opt) => {
	                const val = String(opt?.value ?? opt?.id ?? '');
	                if (!val) return null;
	                const label = String(opt?.label ?? val);
	                const checked = String(currentValue || '') === val;
	                return (
	                    <MenuItem
	                        key={val}
	                        text={label}
	                        icon={checked ? "tick" : "blank"}
	                        onClick={() => {
	                            onChange?.(val);
	                            close(false);
	                        }}
	                    />
	                );
	            })}
	        </Menu>
	    );

		const agentMenu = (options, currentValue, onChange, close) => {
		    const list = Array.isArray(options) ? options : [];
		    const filtered = list.filter((opt) => String(opt?.value ?? opt?.id ?? '') !== 'auto');
		    const isAuto = String(currentValue || '') === 'auto';
		    return (
		        <Menu>
		            <MenuItem
		                text="Auto-select agent"
		                intent={isAuto ? "success" : "primary"}
		                active={isAuto}
		                icon={isAuto ? "tick" : "automatic-updates"}
		                labelElement={isAuto ? <Tag minimal intent="success">On</Tag> : null}
		                data-testid="chat-composer-auto-agent"
		                shouldDismissPopover={false}
		                onClick={(e) => {
		                    try { e?.preventDefault?.(); } catch (_) {}
		                    try { e?.stopPropagation?.(); } catch (_) {}
		                    if (!isAuto) {
		                        onChange?.('auto');
		                        return
		                    }

		                    // Turning auto off: revert to the last manual agent when available,
		                    // otherwise fall back to the first listed agent.
		                    const fallback = String(lastManualAgentRef.current || '').trim();
		                    if (fallback) {
		                        onChange?.(fallback);
		                        return
		                    }
		                    const first = filtered.length ? String(filtered[0]?.value ?? filtered[0]?.id ?? '').trim() : '';
		                    if (first) onChange?.(first);
		                }}
		            />
		            <MenuDivider title="Manual agents" />
		            {filtered.map((opt) => {
		                const val = String(opt?.value ?? opt?.id ?? '');
		                if (!val) return null;
		                const label = String(opt?.label ?? val);
		                const checked = String(currentValue || '') === val;
		                return (
		                    <MenuItem
		                        key={val}
		                        text={label}
		                        icon={checked ? "tick" : (isAuto ? "lock" : "blank")}
		                        disabled={isAuto}
		                        shouldDismissPopover={false}
		                        onClick={() => {
		                            lastManualAgentRef.current = val;
		                            onChange?.(val);
		                        }}
		                    />
		                );
		            })}
		        </Menu>
		    );
		};

    const handleChipClick = (chip) => {
	    const handled = onChipClick?.(chip);
	    if (handled) return;
	    const id = String(chip?.id || '');
	    if (id === 'tools') setBundlesOpen(true);
	    if (id === 'agent') setAgentOpen(true);
	    if (id === 'model') setModelOpen(true);
	    if (id === 'reasoningEffort') setReasoningOpen(true);
	};

    const handleChipClear = (chip) => {
        const handled = onChipClear?.(chip);
        if (handled) return;
    };

    const effectiveQueuedTurns = Array.isArray(queuedTurns) ? queuedTurns : [];
    const effectiveQueueCount = (typeof queueCount === 'number' && !Number.isNaN(queueCount))
        ? queueCount
        : effectiveQueuedTurns.length;

	const toolsSummary = (toolsArr) => {
	    const tools = Array.isArray(toolsArr) ? toolsArr.map(t => String(t || '')).filter(Boolean) : [];
	    if (!tools.length) return '';
	    if (tools.length <= 2) return tools.join(', ');
	    return `${tools.length} tools`;
	};

	const updateSelectedBundles = (nextBundleIDs) => {
	    const desiredBundleIDs = new Set((Array.isArray(nextBundleIDs) ? nextBundleIDs : []).map(normalizeString).filter(Boolean));
	    const unknownSelectedTools = (Array.isArray(selectedTools) ? selectedTools : [])
	        .map(normalizeString)
	        .filter(Boolean)
	        .filter(t => !bundleCatalog.toolToBundle.has(t));

	    const tools = [];
	    for (const bundleID of desiredBundleIDs) {
	        const bundle = bundleCatalog.byId.get(bundleID);
	        if (!bundle) continue;
	        for (const tool of (Array.isArray(bundle.tools) ? bundle.tools : [])) {
	            const toolName = normalizeString(tool);
	            if (toolName) tools.push(toolName);
	        }
	    }
	    updateSelectedTools(Array.from(new Set([...tools, ...unknownSelectedTools])));
	};

	    const openBundlesDialog = () => {
		    setBundlesMenuOpen(false);
		    setBundlesOpen(true);
		};

		const bundlesMenu = (
		    <Menu>
		        <MenuItem
		            text="Auto tools"
		            intent={autoSelectTools ? "success" : "primary"}
		            active={!!autoSelectTools}
		            icon={autoSelectTools ? "tick" : "automatic-updates"}
		            labelElement={autoSelectTools ? <Tag minimal intent="success">On</Tag> : null}
		            data-testid="chat-composer-auto-tools"
		            shouldDismissPopover={false}
		            onClick={() => onAutoSelectToolsChange?.(!autoSelectTools)}
		        />
		        <MenuDivider title="Manual toolsets" />
		        {selectedBundleIDs.length === 0 ? (
		            <MenuItem disabled text={autoSelectTools ? "Toolsets disabled while Auto tools is on" : "No toolsets selected"} />
		        ) : (
		            selectedBundleIDs.map((bundleID) => {
		                const bundle = bundleCatalog.byId.get(bundleID);
		                if (!bundle) return null;
		                return (
		                    <MenuItem
		                        key={bundle.id}
		                        icon={autoSelectTools ? "lock" : "tick"}
		                        text={bundle.label}
		                        shouldDismissPopover={false}
		                        disabled={!!autoSelectTools}
		                        onClick={() => {
		                            const nextIDs = selectedBundleIDs.filter(id => id !== bundle.id);
		                            updateSelectedBundles(nextIDs);
		                        }}
		                    />
		                );
		            }).filter(Boolean)
		        )}
		        <MenuItem icon="more" text="Add toolsets…" onClick={openBundlesDialog} disabled={!!autoSelectTools} />
		    </Menu>
		);

	const selectedBundlesSummary = () => {
	    if (!selectedBundleIDs.length) return '';
	    const labels = selectedBundleIDs
	        .map((id) => bundleCatalog.byId.get(id)?.label || id)
	        .filter(Boolean);
	    if (labels.length <= 2) return labels.join(', ');
	    return `${labels.length} toolsets`;
	};

    const queuePopover = (
        <div style={{ padding: 8, minWidth: 380, maxWidth: 520 }} data-testid="chat-queue-popover">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Queued turns</div>
            {effectiveQueuedTurns.length === 0 ? (
                <div style={{ opacity: 0.75, padding: 6 }}>Queue is empty</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto' }}>
                    {effectiveQueuedTurns.map((t, idx) => {
                        const id = String(t?.id || '');
                        if (!id) return null;
                        const preview = String(t?.preview || '').trim();
                        const o = t?.overrides || {};
                        const agent = String(o?.agent || '').trim();
                        const model = String(o?.model || '').trim();
                        const tools = toolsSummary(o?.tools);
                        const canUp = idx > 0;
                        const canDown = idx < (effectiveQueuedTurns.length - 1);
                        return (
                            <div
                                key={id}
                                style={{ border: '1px solid rgba(16,22,26,0.15)', borderRadius: 8, padding: 8, display: 'flex', gap: 8 }}
                                data-testid={`chat-queue-item-${id}`}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{preview || id}</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {agent ? <Tag minimal>Agent: {agent}</Tag> : null}
                                        {model ? <Tag minimal>Model: {model}</Tag> : null}
                                        {tools ? <Tag minimal>Tools: {tools}</Tag> : null}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <Button
                                        icon="chevron-up"
                                        minimal
                                        small
                                        disabled={!canUp}
                                        data-testid={`chat-queue-up-${id}`}
                                        onClick={(e) => { e.preventDefault(); onQueueMove?.(t, 'up'); }}
                                    />
                                    <Button
                                        icon="chevron-down"
                                        minimal
                                        small
                                        disabled={!canDown}
                                        data-testid={`chat-queue-down-${id}`}
                                        onClick={(e) => { e.preventDefault(); onQueueMove?.(t, 'down'); }}
                                    />
                                    <Button
                                        icon="cross"
                                        minimal
                                        small
                                        intent="danger"
                                        data-testid={`chat-queue-cancel-${id}`}
                                        onClick={(e) => { e.preventDefault(); onQueueCancel?.(t); }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const topPad = (attachments && attachments.length) ? Math.min(12 + attachments.length * 22, 100) : 12;
    const leftIcons = (showUpload ? 1 : 0) + (showSettings ? 1 : 0);
    const rightIcons = 1 + (showMic ? 1 : 0); // send/abort + optional mic
    const attachmentsLeft = 6 + 30 * leftIcons; // align with absolute left controls (6 + 30px per icon)
    const textPadLeft = 12 + 32 * leftIcons;    // base 12 + 32px per icon for inner padding
    const textPadRight = 32 + (rightIcons - 1) * 36; // allow room for mic + send
    const attachmentsRight = 40 + (rightIcons - 1) * 36; // overlay space for right-side icons

	    const currentModelLabel = optionLabel(normalizedModelOptions, modelValue) || 'Model';

	    if (commandCenter) {
	        return (
	            <form className="chat-composer flex flex-col gap-2" onSubmit={handleSubmit} data-testid="chat-composer">
	                <div className="composer-shell" data-testid="chat-composer-shell">
	                <div className="composer-bar" data-testid="chat-composer-bar">
	                    <div className="composer-bar-left">
                        {showUpload && withTooltip(
                            <Button
                                icon="plus"
                                minimal
                                small
                                disabled={disabled}
                                className="composer-icon-btn composer-icon-btn--attach"
                                data-testid="chat-composer-attach"
                                aria-label={uploadTooltip}
                                title={uploadTooltip}
                                onClick={(e) => { e.preventDefault(); onOpenAttach?.(); }}
                            />,
                            uploadTooltip
                        )}
	                        {Array.isArray(normalizedAgentOptions) && normalizedAgentOptions.length > 0 && (
	                            <Popover
	                                content={agentMenu(normalizedAgentOptions, agentValue, onAgentChange, setAgentOpen)}
	                                isOpen={agentOpen}
	                                onInteraction={(open) => setAgentOpen(open)}
	                                closeOnContentClick={false}
	                                placement="bottom-start"
	                            >
                                {withTooltip(
                                    <Button
                                        minimal
                                        small
                                        disabled={disabled}
	                                    active={String(agentValue || '') === 'auto'}
                                        data-testid="chat-composer-agent"
                                        aria-label="Agent"
                                        title="Agent"
                                        className="composer-icon-btn composer-icon-btn--agent"
                                        icon={<UserCircle size={20} weight="duotone" />}
                                        onClick={(e) => { e.preventDefault(); setAgentOpen((v) => !v); }}
                                    />,
                                    `Agent: ${optionLabel(normalizedAgentOptions, agentValue)}`
                                )}
                            </Popover>
                        )}
                        {Array.isArray(normalizedModelOptions) && normalizedModelOptions.length > 0 && (
                            <Popover
                                content={optionMenu(
                                    normalizedModelOptions,
                                    modelValue,
                                    onModelChange,
                                    setModelOpen
                                )}
                                isOpen={modelOpen}
                                onInteraction={(open) => setModelOpen(open)}
                                placement="bottom-start"
                            >
                                {withTooltip(
                                    <Button
                                        minimal
                                        small
                                        disabled={disabled}
                                        data-testid="chat-composer-model"
                                        aria-label="Model"
                                        title="Model"
                                        className="composer-icon-btn composer-icon-btn--model composer-icon-btn--modelText"
                                        icon={<Lightbulb size={20} weight="duotone" />}
	                                    text={currentModelLabel === '—' ? 'Model' : currentModelLabel}
                                        onClick={(e) => { e.preventDefault(); setModelOpen((v) => !v); }}
                                    />,
                                    `Model: ${optionLabel(normalizedModelOptions, modelValue)}`
                                )}
                            </Popover>
                        )}
	                        {hasToolsPicker && (showTools || commandCenter) && (
	                            <Popover
	                                content={bundlesMenu}
	                                isOpen={bundlesMenuOpen}
	                                onInteraction={(open) => setBundlesMenuOpen(open)}
	                                placement="top-start"
	                            >
	                                {withTooltip(
	                                    <Button
	                                        icon="wrench"
	                                        minimal
	                                        small
	                                        disabled={disabled}
	                                        active={!!autoSelectTools}
	                                        className="composer-icon-btn composer-icon-btn--tools"
	                                        data-testid="chat-composer-tools"
	                                        aria-label="Toolsets"
	                                        title="Toolsets"
	                                        onClick={(e) => { e.preventDefault(); setBundlesMenuOpen((v) => !v); }}
	                                    />,
	                                    autoSelectTools
	                                        ? 'Auto tools is on'
	                                        : (selectedBundleIDs.length ? `Toolsets: ${selectedBundlesSummary()}` : 'Toolsets')
	                                )}
	                            </Popover>
	                        )}
	                    </div>

                    <div className="composer-bar-center">
                        {usageSummary ? withTooltip(
                            <div className="composer-usage" data-testid="chat-composer-usage">
                                {usageSummary}
                            </div>,
                            usageTooltip
                        ) : null}
                    </div>

                    <div className="composer-bar-right">
                        {(commandCenter && effectiveQueueCount > 0) && (
                            <Popover
                                content={queuePopover}
                                isOpen={queueOpen}
                                onInteraction={(open) => setQueueOpen(open)}
                                placement="top-end"
                            >
                                <Button
                                    minimal
                                    small
                                    disabled={disabled}
                                    data-testid="chat-composer-queue-badge"
                                    aria-label={`Queued: ${effectiveQueueCount}`}
                                    title={`Queued: ${effectiveQueueCount}`}
                                    onClick={(e) => { e.preventDefault(); setQueueOpen((v) => !v); }}
                                >
                                    Queued: {effectiveQueueCount}
                                </Button>
                            </Popover>
                        )}
                        {Array.isArray(reasoningOptions) && reasoningOptions.length > 0 && (
                            <Popover
                                content={optionMenu(reasoningOptions, reasoningValue, onReasoningChange, setReasoningOpen)}
                                isOpen={reasoningOpen}
                                onInteraction={(open) => setReasoningOpen(open)}
                                placement="bottom-end"
                            >
                                <Button
                                    minimal
                                    small
                                    disabled={disabled}
                                    data-testid="chat-composer-reasoning"
                                    aria-label="Reasoning"
                                    title="Reasoning"
                                    onClick={(e) => { e.preventDefault(); setReasoningOpen((v) => !v); }}
                                >
                                    {String(reasoningValue || '').trim() ? `Reasoning: ${reasoningValue}` : 'Reasoning'}
                                </Button>
                            </Popover>
                        )}

                        {showSettings && withTooltip(
                            <Button
                                icon="cog"
                                minimal
                                small
                                disabled={disabled}
                                className="composer-icon-btn composer-icon-btn--settings"
                                data-testid="chat-composer-settings"
                                aria-label={settingsTooltip || "Settings"}
                                title={settingsTooltip || "Settings"}
                                onClick={(e) => { e.preventDefault(); onOpenSettings?.(); }}
                            />,
                            settingsTooltip
                        )}

                        {showMic && withTooltip(
                            <Button
                                minimal
                                small
                                disabled={disabled}
                                className={`composer-icon-btn composer-icon-btn--mic ${micOn ? 'composer-icon-btn--micOn' : ''}`}
                                data-testid="chat-composer-mic"
                                aria-pressed={micOn}
                                aria-label={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                                title={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                                onClick={(e) => { e.preventDefault(); toggleMic(); }}
                            >
                                {micOn ? <Microphone size={18} weight="fill" /> : <MicrophoneSlash size={18} />}
                            </Button>,
                            micTooltip
                        )}

                        {showAbortButton && withTooltip(
                            <Button
                                icon={abortIconEl}
                                minimal
                                intent="danger"
                                data-testid="chat-composer-abort"
                                aria-label={abortTooltip || "Terminate"}
                                title={abortTooltip || "Terminate"}
                                onClick={handleAbort}
                                disabled={false}
                                type="button"
                            >
                                Abort
                            </Button>,
                            abortTooltip
                        )}

                        {withTooltip(
                            <Button
                                icon={submitIconEl}
                                minimal
                                intent="primary"
                                data-testid="chat-composer-send"
                                aria-label={sendTooltip || submitText}
                                title={sendTooltip || submitText}
                                type="submit"
                                disabled={actionDisabled}
                                loading={disabled}
                            >
                                {submitText}
                            </Button>,
                            sendTooltip
                        )}
                    </div>
                </div>

	                {hasToolsPicker && (showTools || commandCenter) && (
	                    <BundlesDialog
	                        isOpen={bundlesOpen}
	                        onClose={() => setBundlesOpen(false)}
	                        bundles={bundleCatalog.bundles}
	                        selectedBundleIDs={selectedBundleIDs}
	                        onChange={(ids) => updateSelectedBundles(ids)}
	                        disabled={disabled || !!autoSelectTools}
	                    />
	                )}

                {Array.isArray(visibleChips) && visibleChips.length > 0 && (
                    <div className="composer-chips" data-testid="chat-composer-chips">
                        {visibleChips.map((chip) => {
                            const id = String(chip?.id || '');
                            if (!id) return null;
                            const label = String(chip?.label || id);
                            const value = String(chip?.value || '');
                            const clearable = chip?.clearable !== false;
                            const text = value ? `${label}: ${value}` : label;
                            return (
                                <Tag
                                    key={id}
                                    minimal
                                    interactive
                                    onClick={() => handleChipClick(chip)}
                                    onRemove={clearable ? (() => handleChipClear(chip)) : undefined}
                                    data-testid={`chat-chip-${id}`}
                                >
                                    {text}
                                </Tag>
                            );
                        })}
                    </div>
                )}

                {attachments && attachments.length > 0 && (
                    <div className="composer-attachments-inline" data-testid="chat-attachments">
                        {attachments.map((att, idx) => (
                            <Tag
                                key={`${att.name}-${idx}`}
                                minimal
                                onRemove={() => onRemoveAttachment?.(idx)}
                                data-testid={`chat-attachment-${idx}`}
                            >
                                {att.name}
                            </Tag>
                        ))}
                    </div>
                )}

                <TextArea
                    fill
                    placeholder="Type your message…"
                    value={draft}
                    autoResize={autoResize}
                    onChange={(e) => setDraft(e.target.value)}
                    data-testid="chat-composer-input"
                    className="composer-textarea"
                    style={{
                        borderRadius: 12,
                        resize: "none",
                        minHeight: 40,
                        maxHeight: `${composerMaxHeightPx(maxRows, 12)}px`,
                        overflowY: autoResize ? 'auto' : undefined,
                    }}
                    disabled={disabled}
                />
                </div>
            </form>
        );
    }

    return (
        <form className="chat-composer flex flex-col gap-1" onSubmit={handleSubmit} data-testid="chat-composer">
            <div className="flex w-full items-start">
                <div className="composer-wrapper" style={{ flex: 1, minWidth: 0 }}>
                    {showUpload && (
                        withTooltip(
                            <Button
                                icon="plus"
                                minimal
                                small
                                className="composer-attach composer-icon-btn composer-icon-btn--attach"
                                data-testid="chat-composer-attach"
                                disabled={disabled}
                                title={uploadTooltip}
                                aria-label={uploadTooltip}
                                onClick={(e) => { e.preventDefault(); onOpenAttach?.(); }}
                            />,
                            uploadTooltip
                        )
                    )}
                    {showSettings && (
                        withTooltip(
                            <Button
                                icon="cog"
                                minimal
                                small
                                className="composer-attach composer-icon-btn composer-icon-btn--settings"
                                style={{ left: showUpload ? 36 : 6 }}
                                data-testid="chat-composer-settings"
                                disabled={disabled}
                                aria-label={settingsTooltip || "Settings"}
                                title={settingsTooltip || "Settings"}
                                onClick={(e) => { e.preventDefault(); onOpenSettings?.(); }}
                            />,
                            settingsTooltip
                        )
                    )}
                    {attachments && attachments.length > 0 && (
                        <div
                            className="composer-attachments"
                            style={{ left: attachmentsLeft, right: attachmentsRight }}
                            data-testid="chat-attachments"
                        >
                            <table style={{ width: '100%', tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '28px' }} />
                                    <col />
                                </colgroup>
                                <tbody>
                                {attachments.map((att, idx) => (
                                    <tr key={`${att.name}-${idx}`}>
                                        <td style={{ padding: '2px 0' }}>
                                            <Button
                                                minimal
                                                small
                                                icon="cross"
                                                onClick={() => onRemoveAttachment?.(idx)}
                                                aria-label={`Remove ${att.name}`}
                                                data-testid={`chat-attachment-remove-${idx}`}
                                            />
                                        </td>
                                        <td style={{ padding: '2px 0' }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.name}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <TextArea
                        fill
                        placeholder="Type your message…"
                        value={draft}
                        autoResize={autoResize}
                        onChange={(e) => setDraft(e.target.value)}
                        data-testid="chat-composer-input"
                        style={{
                            borderRadius: 14,
                            resize: "none",
                            minHeight: 40,
                            maxHeight: `${composerMaxHeightPx(maxRows, topPad)}px`,
                            overflowY: autoResize ? 'auto' : undefined,
                            paddingRight: textPadRight,
                            paddingLeft: textPadLeft,
                            paddingTop: topPad,
                        }}
                        disabled={disabled}
                    />

                    {showMic && withTooltip(
                        <Button
                            minimal
                            className={`composer-mic composer-icon-btn composer-icon-btn--mic ${micOn ? 'composer-icon-btn--micOn' : ''}`}
                            style={{ width: 28, height: 28, right: 44 }}
                            onClick={(e) => { e.preventDefault(); toggleMic(); }}
                            disabled={disabled}
                            data-testid="chat-composer-mic"
                            aria-pressed={micOn}
                            aria-label={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                            title={micTooltip || (micOn ? 'Disable mic' : 'Enable mic')}
                        >
                            {micOn ? <Microphone size={18} weight="fill" /> : <MicrophoneSlash size={18} />}
                        </Button>,
                        micTooltip
                    )}

                    {/* Single action button: send by default or abort when showAbort */}
                    {withTooltip(
                        <Button
                            icon={terminateOverridesSubmit ? abortIconEl : submitIconEl}
                            minimal
                            intent={terminateOverridesSubmit ? "danger" : "primary"}
                            className="composer-send"
                            data-testid={terminateOverridesSubmit ? "chat-composer-abort" : "chat-composer-send"}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 9999,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            aria-label={terminateOverridesSubmit ? (abortTooltip || "Terminate") : (sendTooltip || submitText)}
                            title={terminateOverridesSubmit ? (abortTooltip || "Terminate") : (sendTooltip || submitText)}
                            {...( 
                                terminateOverridesSubmit
                                    ? { onClick: handleAbort, disabled: false, type: "button" }
                                    : {
                                          type: "submit",
                                          disabled: actionDisabled,
                                          loading: disabled,
                                      }
                            )}
                        />,
                        terminateOverridesSubmit ? abortTooltip : sendTooltip
                    )}
                </div>
            </div>

            {/* no external attach row; plus icon lives inside the input */}
        </form>
    );
}
