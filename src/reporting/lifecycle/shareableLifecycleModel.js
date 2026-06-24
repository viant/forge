function normalizeString(value = "") {
  return String(value || "").trim();
}

function normalizeLifecycle(value = "") {
  return normalizeString(value).toLowerCase();
}

function isPlainObject(value = null) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCapabilities(value = null) {
  if (!isPlainObject(value)) {
    return {};
  }
  return Object.entries(value).reduce((acc, [key, flag]) => {
    if (typeof flag === "boolean") {
      acc[normalizeString(key)] = flag;
    }
    return acc;
  }, {});
}

export const SHAREABLE_LIFECYCLES = Object.freeze(["draft", "published", "archived"]);

const LIFECYCLE_TRANSITIONS = Object.freeze({
  draft: new Set(["published"]),
  published: new Set(["archived"]),
  archived: new Set([]),
});

export function buildShareableLifecycleTransition(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const artifactRef = normalizeString(value?.artifactRef);
  const from = normalizeLifecycle(value?.from);
  const to = normalizeLifecycle(value?.to);
  const reason = normalizeString(value?.reason);
  if (!artifactRef && !from && !to && !reason) {
    return null;
  }
  return {
    ...(artifactRef ? { artifactRef } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(reason ? { reason } : {}),
  };
}

export function validateShareableLifecycleTransition(value = null) {
  const transition = buildShareableLifecycleTransition(value);
  if (!transition) {
    return {
      valid: false,
      errors: [
        {
          path: "$",
          code: "required",
          message: "Lifecycle transition payload is required.",
        },
      ],
    };
  }
  const errors = [];
  if (!transition.artifactRef) {
    errors.push({
      path: "$.artifactRef",
      code: "required",
      message: "Lifecycle transitions require an artifactRef.",
    });
  }
  if (!transition.from) {
    errors.push({
      path: "$.from",
      code: "required",
      message: "Lifecycle transitions require a from state.",
    });
  } else if (!SHAREABLE_LIFECYCLES.includes(transition.from)) {
    errors.push({
      path: "$.from",
      code: "invalid",
      message: `Unsupported lifecycle state '${transition.from}'.`,
    });
  }
  if (!transition.to) {
    errors.push({
      path: "$.to",
      code: "required",
      message: "Lifecycle transitions require a to state.",
    });
  } else if (!SHAREABLE_LIFECYCLES.includes(transition.to)) {
    errors.push({
      path: "$.to",
      code: "invalid",
      message: `Unsupported lifecycle state '${transition.to}'.`,
    });
  }
  if (transition.from && transition.to && SHAREABLE_LIFECYCLES.includes(transition.from) && SHAREABLE_LIFECYCLES.includes(transition.to)) {
    const allowed = LIFECYCLE_TRANSITIONS[transition.from] || new Set();
    if (!allowed.has(transition.to)) {
      errors.push({
        path: "$.to",
        code: "invalidTransition",
        message: `Lifecycle transition '${transition.from}' -> '${transition.to}' is not allowed.`,
      });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildShareableLifecycleActionViewState(value = null) {
  if (!isPlainObject(value)) {
    return null;
  }
  const lifecycle = normalizeLifecycle(value?.lifecycle);
  const capabilities = normalizeCapabilities(value?.shareableCapabilities || value?.capabilities);
  const availableActions = [];
  const blockedActions = [];

  if (capabilities.view === true) {
    availableActions.push("View");
  }
  if (capabilities.share === true) {
    availableActions.push("Share");
  } else if (capabilities.share === false) {
    blockedActions.push("Share");
  }
  if (capabilities.export === true) {
    availableActions.push("Export");
  }

  if (lifecycle === "draft") {
    if (capabilities.publish === true) {
      availableActions.push("Publish");
    } else if (capabilities.publish === false) {
      blockedActions.push("Publish");
    }
  }

  if (lifecycle === "published") {
    if (capabilities.archive === true) {
      availableActions.push("Archive");
    } else if (capabilities.archive === false) {
      blockedActions.push("Archive");
    }
  }

  if (availableActions.length === 0 && blockedActions.length === 0) {
    return null;
  }

  return {
    ...(availableActions.length > 0 ? { availableActions } : {}),
    ...(blockedActions.length > 0 ? { blockedActions } : {}),
  };
}
