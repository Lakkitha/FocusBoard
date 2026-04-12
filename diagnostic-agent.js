// diagnostic-agent.js
// ============================================================
// PURPOSE: Validate FocusBoard's data integrity and Ollama
//          connection — run this in Node.js from the project root
//
// Usage: node diagnostic-agent.js
// Requires: npm install node-fetch (if Node < 18, else fetch is built-in)
// ============================================================

const { readFileSync, existsSync, writeFileSync } = require("fs");
const { resolve, join } = require("path");
const os = require("os");

const fetchFn =
  typeof fetch === "function"
    ? fetch
    : (...args) =>
        import("node-fetch").then(({ default: nodeFetch }) => nodeFetch(...args));

function withTimeout(timeoutMs = 15000) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

// ─────────────────────────────────────────────────────────────
// SECTION 1: CONFIGURATION
// Mirror the exact paths used in electron/main.js and useStore.js
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Matches electron/main.js: path.join(app.getPath("appData"), "FocusBoard")
  // We simulate appData resolution for Node.js outside Electron
  appDataDir: join(os.homedir(), "AppData", "Roaming", "FocusBoard"), // Windows
  // appDataDir: join(os.homedir(), "Library", "Application Support", "FocusBoard"), // macOS
  // appDataDir: join(os.homedir(), ".config", "FocusBoard"), // Linux

  dataFileName: "focusboard-data.json",

  ollamaEndpoint: "http://localhost:11434/api/generate",
  ollamaModel: "mistral:7b", // Matches src/config/ai.js

  // Matches DEFAULT_STATE in src/store/useStore.js
  requiredTopLevelKeys: [
    "courses",
    "projects",
    "personalProjects",
    "sessions",
    "goals",
    "categoryTargets",
    "customViews",
    "lockedInByDate",
    "chatThreads",
    "activeChatThreadId",
  ],

  // Matches BUILTIN_CATEGORIES in src/viewConfig.js
  builtinCategoryKeys: ["courses", "passive", "personal", "work", "health"],

  // Matches DEFAULT_STATE.categoryTargets in src/store/useStore.js
  requiredCategoryTargetKeys: ["courses", "passive", "work", "health", "personal"],

  // Matches session type map in viewConfig.js: TYPE_TO_CATEGORY
  validSessionTypes: ["course", "project", "personal", "work", "health"],
};

// ─────────────────────────────────────────────────────────────
// SECTION 2: PYTHON-STYLE INSPECTION FUNCTIONS
// ─────────────────────────────────────────────────────────────

function inspectPersistedFile(config) {
  const findings = {
    dataFilePath: join(config.appDataDir, config.dataFileName),
    fileExists: false,
    fileReadable: false,
    fileSizeBytes: 0,
    parseSuccess: false,
    rawData: null,
    errors: [],
  };

  try {
    findings.fileExists = existsSync(findings.dataFilePath);

    if (!findings.fileExists) {
      findings.errors.push(
        `File not found at ${findings.dataFilePath}. ` +
          `If running in browser mode, data lives in localStorage under 'focusboard-data'. ` +
          `Adjust CONFIG.appDataDir to match your OS.`,
      );
      return findings;
    }

    const raw = readFileSync(findings.dataFilePath, "utf-8");
    findings.fileReadable = true;
    findings.fileSizeBytes = Buffer.byteLength(raw, "utf-8");

    findings.rawData = JSON.parse(raw);
    findings.parseSuccess = true;
  } catch (e) {
    findings.errors.push(e.message);
  }

  return findings;
}

function inspectStoreShape(rawData, config) {
  const findings = {
    allRequiredKeysPresent: false,
    missingKeys: [],
    typeErrors: [],
    categoryTargetsValid: false,
    missingCategoryTargets: [],
    customViewsCount: 0,
    customViewsShapeValid: true,
    customViewsShapeErrors: [],
  };

  if (!rawData) {
    findings.typeErrors.push("rawData is null — file inspection failed upstream");
    return findings;
  }

  findings.missingKeys = config.requiredTopLevelKeys.filter((key) => !(key in rawData));
  findings.allRequiredKeysPresent = findings.missingKeys.length === 0;

  const arrayFields = [
    "courses",
    "projects",
    "personalProjects",
    "sessions",
    "goals",
    "customViews",
    "chatThreads",
  ];
  for (const field of arrayFields) {
    if (field in rawData && !Array.isArray(rawData[field])) {
      findings.typeErrors.push(`"${field}" should be an Array but got ${typeof rawData[field]}`);
    }
  }

  if (rawData.categoryTargets) {
    findings.missingCategoryTargets = config.requiredCategoryTargetKeys.filter(
      (key) => !(key in rawData.categoryTargets),
    );
    findings.categoryTargetsValid = findings.missingCategoryTargets.length === 0;
  }

  if (Array.isArray(rawData.customViews)) {
    findings.customViewsCount = rawData.customViews.length;
    for (const view of rawData.customViews) {
      const requiredViewFields = ["id", "key", "label", "color", "createdAt"];
      const missing = requiredViewFields.filter((f) => !(f in view));
      if (missing.length > 0) {
        findings.customViewsShapeValid = false;
        findings.customViewsShapeErrors.push(
          `customView "${view.label || view.id}" is missing fields: ${missing.join(", ")}`,
        );
      }
      if (view.key && !view.key.startsWith("custom-")) {
        findings.customViewsShapeErrors.push(
          `customView key "${view.key}" doesn't start with "custom-" — ` +
            `may conflict with builtin category keys`,
        );
        findings.customViewsShapeValid = false;
      }
    }
  }

  return findings;
}

function inspectSessions(rawData, config) {
  const findings = {
    totalSessions: 0,
    validSessions: 0,
    invalidSessions: [],
    orphanedSessions: [],
    categoryBreakdown: {},
  };

  if (!rawData || !Array.isArray(rawData.sessions)) return findings;

  findings.totalSessions = rawData.sessions.length;

  const courseIds = new Set((rawData.courses || []).map((c) => c.id));
  const projectIds = new Set((rawData.projects || []).map((p) => p.id));
  const personalIds = new Set((rawData.personalProjects || []).map((p) => p.id));
  const customViewKeys = new Set((rawData.customViews || []).map((v) => v.key));

  for (const session of rawData.sessions) {
    const issues = [];
    const isBuiltinType = config.validSessionTypes.includes(session.type);
    const isCustomCategory = session.category && customViewKeys.has(session.category);

    if (!isBuiltinType && !isCustomCategory) {
      issues.push(`unknown type "${session.type}" and no matching custom category`);
    }

    const needsRef = ["course", "project", "personal"].includes(session.type);
    if (needsRef && !session.refId) {
      issues.push(`type "${session.type}" requires a refId but none found`);
    }

    if (session.type === "course" && session.refId && !courseIds.has(session.refId)) {
      findings.orphanedSessions.push({
        id: session.id,
        type: session.type,
        refId: session.refId,
        reason: "Referenced course no longer exists",
      });
    }
    if (session.type === "project" && session.refId && !projectIds.has(session.refId)) {
      findings.orphanedSessions.push({
        id: session.id,
        type: session.type,
        refId: session.refId,
        reason: "Referenced passive income project no longer exists",
      });
    }
    if (session.type === "personal" && session.refId && !personalIds.has(session.refId)) {
      findings.orphanedSessions.push({
        id: session.id,
        type: session.type,
        refId: session.refId,
        reason: "Referenced personal project no longer exists",
      });
    }

    if (!session.date || Number.isNaN(new Date(session.date).getTime())) {
      issues.push(`invalid or missing date: "${session.date}"`);
    }

    if (typeof session.minutes !== "number" || session.minutes <= 0) {
      issues.push(`minutes must be a positive number, got: ${session.minutes}`);
    }

    if (issues.length > 0) {
      findings.invalidSessions.push({ id: session.id, issues });
    } else {
      findings.validSessions++;
    }

    const catKey =
      session.category ||
      {
        course: "courses",
        project: "passive",
        personal: "personal",
        work: "work",
        health: "health",
      }[session.type] ||
      "unknown";

    findings.categoryBreakdown[catKey] = (findings.categoryBreakdown[catKey] || 0) + 1;
  }

  return findings;
}

function inspectAIContextInputs(rawData) {
  const findings = {
    weeklyBudgetInputsValid: true,
    streakInputsValid: true,
    goalsInputsValid: true,
    lockedInInputsValid: true,
    issues: [],
  };

  if (!rawData) return findings;

  const sessionFieldsOk = (rawData.sessions || []).every(
    (s) => s.date && s.minutes !== undefined && (s.type || s.category),
  );
  if (!sessionFieldsOk) {
    findings.weeklyBudgetInputsValid = false;
    findings.issues.push(
      "Some sessions are missing date/minutes/type — weeklyBudget computation in buildAIContext will be inaccurate",
    );
  }

  if (!rawData.sessions || rawData.sessions.length === 0) {
    findings.streakInputsValid = false;
    findings.issues.push("No sessions found — streak will always be 0");
  }

  for (const goal of rawData.goals || []) {
    if (!goal.weekKey || !goal.text || typeof goal.done !== "boolean") {
      findings.goalsInputsValid = false;
      findings.issues.push(`Goal "${goal.id}" is missing weekKey, text, or done field`);
      break;
    }
  }

  for (const [dateKey, day] of Object.entries(rawData.lockedInByDate || {})) {
    if (
      typeof day.morning !== "boolean" ||
      typeof day.noon !== "boolean" ||
      typeof day.night !== "boolean"
    ) {
      findings.lockedInInputsValid = false;
      findings.issues.push(
        `lockedInByDate["${dateKey}"] has non-boolean period values — getLockedInScore() will return NaN`,
      );
      break;
    }
  }

  return findings;
}

async function inspectOllama(config) {
  const findings = {
    ollamaReachable: false,
    modelAvailable: false,
    chatEndpointWorks: false,
    generateEndpointWorks: false,
    responseSnippet: null,
    errors: [],
  };

  try {
    const chatRes = await fetchFn(config.ollamaEndpoint.replace("/generate", "/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [{ role: "user", content: "ping" }],
        stream: false,
      }),
      signal: withTimeout(15000),
    });

    if (chatRes.ok) {
      const data = await chatRes.json();
      findings.ollamaReachable = true;
      findings.modelAvailable = true;
      findings.chatEndpointWorks = true;
      findings.responseSnippet = data?.message?.content?.slice(0, 80) || null;
    } else if (chatRes.status === 404) {
      findings.errors.push("/api/chat returned 404 — ollamaService.js will fall back to /api/generate");
    }
  } catch (e) {
    findings.errors.push(`/api/chat failed: ${e.message}`);
  }

  try {
    const genRes = await fetchFn(config.ollamaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: "ping",
        stream: false,
      }),
      signal: withTimeout(15000),
    });

    if (genRes.ok) {
      findings.ollamaReachable = true;
      findings.generateEndpointWorks = true;
      if (!findings.modelAvailable) {
        const data = await genRes.json();
        findings.modelAvailable = true;
        findings.responseSnippet = findings.responseSnippet || data?.response?.slice(0, 80) || null;
      }
    }
  } catch (e) {
    findings.errors.push(`/api/generate failed: ${e.message}`);
  }

  return findings;
}

function buildDiagnosticPrompt(allFindings, config) {
  const findingsJson = JSON.stringify(allFindings, null, 2);

  return `[INST]
You are a diagnostic AI agent for FocusBoard, a local Electron + React productivity app.
Your ONLY job is to analyze the inspection findings below and return a structured JSON health report.

You MUST respond with ONLY valid JSON. No explanations, no prose, no markdown code fences.

## ARCHITECTURE CONTEXT (use this to interpret the findings):
- Data is persisted as a single JSON file via Electron's ipcMain in electron/main.js
- The Zustand store (src/store/useStore.js) defines the schema via DEFAULT_STATE
- Sessions link to courses/projects/personalProjects via a refId field
- The type field on sessions maps to category keys via TYPE_TO_CATEGORY in viewConfig.js
- Custom views have keys prefixed with "custom-" and must also appear in categoryTargets
- AI context is built by buildAIContext.js which reads sessions, goals, lockedInByDate
- Ollama serves Mistral 7B locally at http://localhost:11434 with two endpoints:
    Primary:  /api/chat  (uses messages array)
    Fallback: /api/generate (uses prompt string, triggered on 404 from /api/chat)

## DIAGNOSTIC CRITERIA:

FILE CHECK:
- fileExists must be true — if false, the app has never been saved or wrong path used
- parseSuccess must be true — if false, the JSON is corrupted

STORE SHAPE CHECK:
- allRequiredKeysPresent must be true — missing keys mean DEFAULT_STATE was changed without migration
- typeErrors must be empty — wrong types cause silent runtime failures in React
- categoryTargetsValid must be true — missing targets cause NaN in budget calculations
- customViewsShapeValid must be true — malformed views break the sidebar and LogSession

SESSION INTEGRITY CHECK:
- invalidSessions must be empty — invalid sessions corrupt weekly budget and AI context
- orphanedSessions should ideally be empty — orphans are harmless but waste storage
- categoryBreakdown should cover at least the builtin categories if sessions exist

AI CONTEXT INPUTS CHECK:
- All four validity flags should be true — any false means buildAIContext.js will
  produce incomplete data sent to Mistral, degrading AI coach quality

OLLAMA CHECK:
- ollamaReachable must be true — if false, ALL AI features silently fail
- At least one of chatEndpointWorks or generateEndpointWorks must be true
- modelAvailable must be true — if false, run: ollama pull ${config.ollamaModel}

## INSPECTION FINDINGS:
${findingsJson}

## REQUIRED OUTPUT SCHEMA — respond with exactly this structure:
{
  "report_timestamp": "<ISO 8601 string>",
  "overall_status": "<HEALTHY | DEGRADED | CRITICAL>",
  "checks": {
    "persisted_file": {
      "status": "<PASS | WARN | FAIL>",
      "finding": "<one concise sentence describing what was found>",
      "action_required": <null or "specific actionable fix instruction as a string">
    },
    "store_schema": {
      "status": "<PASS | WARN | FAIL>",
      "finding": "<one concise sentence>",
      "action_required": <null or string>
    },
    "session_integrity": {
      "status": "<PASS | WARN | FAIL>",
      "finding": "<one concise sentence including counts of invalid/orphaned>",
      "action_required": <null or string>
    },
    "ai_context_inputs": {
      "status": "<PASS | WARN | FAIL>",
      "finding": "<one concise sentence>",
      "action_required": <null or string>
    },
    "ollama_mistral": {
      "status": "<PASS | WARN | FAIL>",
      "finding": "<one concise sentence including which endpoints work>",
      "action_required": <null or string>
    }
  },
  "critical_issues": ["<only issues that break core functionality, empty array if none>"],
  "warnings": ["<non-breaking issues worth fixing, empty array if none>"],
  "data_summary": {
    "total_sessions": <integer>,
    "total_courses": <integer>,
    "total_projects": <integer>,
    "total_personal_projects": <integer>,
    "total_goals": <integer>,
    "total_custom_views": <integer>,
    "category_breakdown": <object from session findings or null>
  },
  "recommended_next_step": "<the single most impactful action to take right now>"
}
[/INST]`;
}

async function callMistral(prompt, config) {
  try {
    const response = await fetchFn(config.ollamaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.0,
          top_p: 1.0,
          num_predict: 1500,
        },
      }),
      signal: withTimeout(120000),
    });

    const data = await response.json();
    const raw = data?.response || "";
    const clean = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(clean);
  } catch (e) {
    return {
      error: `Mistral call failed: ${e.message}`,
      fallback_note: "Run the checks manually using the inspection_data in the saved report file",
    };
  }
}

async function runDiagnostic() {
  console.log("=".repeat(60));
  console.log("  FOCUSBOARD DIAGNOSTIC AGENT");
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  console.log("\n[1/5] Inspecting persisted data file...");
  const fileFindings = inspectPersistedFile(CONFIG);

  console.log("[2/5] Inspecting store schema...");
  const shapeFindings = inspectStoreShape(fileFindings.rawData, CONFIG);

  console.log("[3/5] Inspecting session integrity...");
  const sessionFindings = inspectSessions(fileFindings.rawData, CONFIG);

  console.log("[4/5] Inspecting AI context inputs...");
  const aiContextFindings = inspectAIContextInputs(fileFindings.rawData);

  console.log("[5/5] Inspecting Ollama/Mistral connection...");
  const ollamaFindings = await inspectOllama(CONFIG);

  const allFindings = {
    file: fileFindings,
    store_shape: shapeFindings,
    session_integrity: sessionFindings,
    ai_context_inputs: aiContextFindings,
    ollama: ollamaFindings,
    raw_data_summary: fileFindings.rawData
      ? {
          courses_count: (fileFindings.rawData.courses || []).length,
          projects_count: (fileFindings.rawData.projects || []).length,
          personal_projects_count: (fileFindings.rawData.personalProjects || []).length,
          sessions_count: (fileFindings.rawData.sessions || []).length,
          goals_count: (fileFindings.rawData.goals || []).length,
          custom_views_count: (fileFindings.rawData.customViews || []).length,
          locked_in_days_count: Object.keys(fileFindings.rawData.lockedInByDate || {}).length,
          chat_threads_count: (fileFindings.rawData.chatThreads || []).length,
        }
      : null,
  };

  let report;
  if (ollamaFindings.ollamaReachable) {
    console.log("\n[Mistral] Analyzing findings and generating health report...");
    const prompt = buildDiagnosticPrompt(allFindings, CONFIG);
    report = await callMistral(prompt, CONFIG);
  } else {
    console.log(
      "\n[!] Ollama unreachable — skipping Mistral analysis. Raw findings saved to report file.",
    );
    report = {
      overall_status: "CRITICAL",
      error: "Ollama not reachable — cannot generate AI analysis",
      raw_findings_available: true,
    };
  }

  console.log("\n" + "=".repeat(60));
  console.log("  DIAGNOSTIC REPORT");
  console.log("=".repeat(60));
  console.log(JSON.stringify(report, null, 2));

  const outputPath = resolve("./focusboard-diagnostic-report.json");
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        config_used: CONFIG,
        inspection_data: allFindings,
        mistral_report: report,
      },
      null,
      2,
    ),
  );
  console.log(`\n[✓] Full report saved to: ${outputPath}`);

  if (report?.overall_status === "CRITICAL") {
    process.exit(1);
  }
}

runDiagnostic().catch((e) => {
  console.error("Diagnostic agent crashed:", e);
  process.exit(1);
});
