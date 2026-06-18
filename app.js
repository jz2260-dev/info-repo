const fallbackRecords = [
  {
    id: "KB-001",
    title: '"G: Drive" is missing',
    department: "Service Desk (Stern)",
    system: "No escalation listed",
    severity: "Medium",
    keywords: "Error Google Drive",
    issues: "",
    solution: "G Drive is the Google Drive desktop app. Stern imaged PCs should have this installed already. They just need to log back in.",
    steps: [
      "Confirm the user is referring to the Google Drive desktop app.",
      "Ask them to log back into the Google Drive desktop app."
    ],
    escalation: "No escalation listed.",
    owner: "Service Desk (Stern)",
    reviewed: "Imported CSV",
    source: "Topics CSV",
    moreInfo: "https://support.google.com/drive/answer/10838124?hl=en&ref_topic=11413606",
    attachments: "",
    relatedKbs: ""
  },
  {
    id: "KB-002",
    title: "12Twenty access / Career Account",
    department: "Stern Webspace",
    system: "AppDev",
    severity: "Low",
    keywords: "Error Alumni",
    issues: "12Twenty is the portal used by Career Center of Working Professionals.",
    solution: "Stern IT does not manage this site, please reach out to CCWP for further help.\nPlease provide information after they have activated their Stern account",
    steps: [
      "Direct the user to CCWP for further help.",
      "Provide information after the user's Stern account has been activated."
    ],
    escalation: "AppDev",
    owner: "Stern Webspace",
    reviewed: "Imported CSV",
    source: "Topics CSV",
    moreInfo: "Phone: (212) 998-0235\nE-mail: ccwp@stern.nyu.edu",
    attachments: "",
    relatedKbs: ""
  },
  {
    id: "KB-003",
    title: "Access to Adobe Creative Cloud / Adobe Acrobat",
    department: "Service Desk (Stern)",
    system: "No escalation listed",
    severity: "High",
    keywords: "Adobe Access Adobe Acrobat Subscription Free Trial Request Access",
    issues: "Client is unable to access their Adobe Creative Cloud or Adobe Acrobat. They are getting an error asking them to subscribe or that their trial period is ending.",
    solution: "1) Make sure they are logged into their NYU account\n2) Ask them to log out from all Adobe Applications\n3) When logging back in, for 'Email Address', they should put in 'nyu.edu'. This will prompt for their NYU credentials to sign in.",
    steps: [
      "Make sure they are logged into their NYU account.",
      "Ask them to log out from all Adobe Applications.",
      "When logging back in, enter nyu.edu for Email Address so the NYU credentials prompt appears."
    ],
    escalation: "No escalation listed.",
    owner: "Service Desk (Stern)",
    reviewed: "Imported CSV",
    source: "Expiring/Expired Adobe Creative Cloud License",
    moreInfo: "Adobe Access is only available for Faculty and Admins. Ph.D students are still considered Students.",
    attachments: "",
    relatedKbs: "Expiring/Expired Adobe Creative Cloud License"
  }
];

let records = [];
let drafts = [];
let selectedId = "";
let selectedDraftKey = "";
let editorOpen = false;
let draftPanelOpen = false;
let editorMode = "record";
let dataMode = "csv";
let pendingDraftAction = "";
let pendingDraftActionExpires = 0;

const appConfig = window.APP_CONFIG || {};
const appsScriptUrl = String(appConfig.APPS_SCRIPT_URL || "").trim();
const backendEnabled = /^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/[^/]+\/s)\/.+\/exec$/.test(appsScriptUrl);

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "please",
  "the",
  "to",
  "with"
]);

const DEFAULT_SEARCH_ALIAS_GROUPS = [
  ["zoom", "nyu zoom", "zoom cloud", "cloud recording", "cloud recordings", "meeting recording", "meeting recordings", "recorded meeting"],
  ["adobe", "adobe creative cloud", "creative cloud", "acrobat", "adobe acrobat", "pdf", "license", "licensed"],
  ["g drive", "g: drive", "google drive", "drive missing", "shared drive", "network drive", "mapped drive"],
  ["wifi", "wi fi", "wireless", "nyu wifi", "nyu wireless", "eduroam"],
  ["vpn", "globalprotect", "global protect", "remote access", "cisco", "cisco secure client", "anyconnect"],
  ["email", "e mail", "gmail", "stern gmail", "nyu email", "mail"],
  ["password", "login", "log in", "sign in", "netid", "nyu account", "credentials", "sso"],
  ["duo", "mfa", "2fa", "two factor", "multi factor", "authentication"],
  ["printer", "printing", "print", "papercut"],
  ["campusgroups", "campus groups", "student group", "club", "group access"],
  ["12twenty", "career account", "career center", "ccwp"],
  ["nyu classes", "classes", "brightspace"],
  ["sharepoint", "one drive", "onedrive"],
  ["tableau", "analytics", "dashboard"],
  ["qualtrics", "survey", "surveys"]
];

let searchAliasGroups = DEFAULT_SEARCH_ALIAS_GROUPS.map((group) => group.slice());

const fields = {
  query: document.querySelector("#query"),
  department: document.querySelector("#departmentFilter"),
  system: document.querySelector("#systemFilter"),
  outputMode: document.querySelector("#outputMode"),
  resultsPanel: document.querySelector(".results-panel"),
  results: document.querySelector("#results"),
  matchCount: document.querySelector("#matchCount"),
  title: document.querySelector("#recordTitle"),
  meta: document.querySelector("#recordMeta"),
  reviewMeta: document.querySelector("#recordReviewMeta"),
  answer: document.querySelector("#answer"),
  editor: document.querySelector("#editor"),
  dataStatus: document.querySelector("#dataSourceStatus"),
  draftsPanel: document.querySelector("#draftsPanel"),
  draftList: document.querySelector("#draftList"),
  draftCount: document.querySelector("#draftCount"),
  newDraft: document.querySelector("#newDraft"),
  toggleDrafts: document.querySelector("#toggleDrafts"),
  publishDraft: document.querySelector("#publishDraft"),
  deleteDraft: document.querySelector("#deleteDraft"),
  toggleEditor: document.querySelector("#toggleEditor")
};

function setDataStatus(text, state = "ok") {
  if (!fields.dataStatus) return;
  fields.dataStatus.textContent = text;
  fields.dataStatus.classList.toggle("warning", state === "warning");
  fields.dataStatus.classList.toggle("error", state === "error");
}

async function backendRequest(payload) {
  const response = await fetch(appsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Backend request failed");
  }
  return data;
}

function normalizeBackendRecord(record) {
  return {
    id: record.id || crypto.randomUUID(),
    title: record.title || "Untitled record",
    department: record.department || "General",
    system: record.system || record.escalation || "No escalation listed",
    severity: record.severity || (record.escalation ? "Medium" : "Low"),
    keywords: record.keywords || "",
    issues: record.issues || "",
    solution: record.solution || record.issues || record.moreInfo || "",
    steps: asList(record.steps || record.solution || ""),
    escalation: record.escalation || record.system || "No escalation listed",
    owner: record.owner || record.department || "General",
    reviewed: record.reviewed || record.updatedAt || "From Google Sheet",
    source: record.source || record.relatedKbs || "Google Sheet",
    moreInfo: record.moreInfo || "",
    attachments: record.attachments || "",
    relatedKbs: normalize(record.relatedKbs) === "google sheet" ? "" : (record.relatedKbs || ""),
    status: record.status || "Active",
    updatedAt: record.updatedAt || "",
    updatedBy: record.updatedBy || "",
    reviewedBy: record.reviewedBy || record.updatedBy || ""
  };
}

function normalizeBackendDraft(draft) {
  const record = normalizeBackendRecord(draft.record || draft);
  return {
    draftId: draft.draftId || crypto.randomUUID(),
    recordId: draft.recordId || record.id || "",
    version: Number(draft.version || 1),
    status: draft.status || "Draft",
    createdAt: draft.createdAt || "",
    createdBy: draft.createdBy || "",
    updatedAt: draft.updatedAt || "",
    updatedBy: draft.updatedBy || "",
    publishedAt: draft.publishedAt || "",
    publishedRecordId: draft.publishedRecordId || "",
    record
  };
}

async function loadBackendRecords() {
  const data = await backendRequest({ action: "listRecords" });
  searchAliasGroups = normalizeSearchSynonymGroups(data.searchSynonyms);
  drafts = (data.drafts || []).map(normalizeBackendDraft);
  return (data.records || []).map(normalizeBackendRecord);
}

async function loadBackendDrafts() {
  const data = await backendRequest({ action: "listDrafts" });
  drafts = (data.drafts || []).map(normalizeBackendDraft);
  return drafts;
}

async function saveDraftToBackend(draft) {
  const data = await backendRequest({
    action: "saveDraft",
    draft
  });
  return normalizeBackendDraft(data.draft || draft);
}

async function deleteDraftFromBackend(draftId) {
  const data = await backendRequest({
    action: "deleteDraft",
    draftId
  });
  return data.deleted || 0;
}

async function publishDraftToBackend(draftId, version) {
  const data = await backendRequest({
    action: "publishDraft",
    draftId,
    version
  });
  return normalizeBackendRecord(data.record || {});
}

async function saveRecordToBackend(record) {
  const data = await backendRequest({
    action: "saveRecord",
    record
  });
  return normalizeBackendRecord(data.record || record);
}

async function replaceBackendRecords(nextRecords) {
  const data = await backendRequest({
    action: "replaceAllRecords",
    records: nextRecords
  });
  return (data.records || nextRecords).map(normalizeBackendRecord);
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularToken(token) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && /(ches|shes|sses|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenVariants(token) {
  const variants = new Set([token]);
  variants.add(singularToken(token));
  if (token.length > 5 && token.endsWith("ing")) variants.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith("ed")) variants.add(token.slice(0, -2));
  return [...variants].filter(Boolean);
}

function tokenizeSearchText(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
  return [...new Set(tokens.flatMap(tokenVariants))];
}

function addSearchTerm(term, tokens, phrases) {
  const normalized = normalizeSearchText(term);
  if (!normalized) return;
  const termTokens = tokenizeSearchText(normalized);
  termTokens.forEach((token) => tokens.add(token));
  const phraseTokens = normalized
    .split(" ")
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
  if (phraseTokens.length > 1) phrases.add(phraseTokens.join(" "));
}

function normalizeSearchSynonymGroups(groups) {
  if (!Array.isArray(groups) || !groups.length) {
    return DEFAULT_SEARCH_ALIAS_GROUPS.map((group) => group.slice());
  }

  const normalizedGroups = groups
    .map((group) => {
      const terms = Array.isArray(group)
        ? group
        : [group.term, group.primary, group.synonyms, group.aliases].filter(Boolean).join("|").split("|");
      return [...new Set(terms.map((term) => String(term || "").trim()).filter(Boolean))];
    })
    .filter((group) => group.length > 1);

  return normalizedGroups.length ? normalizedGroups : DEFAULT_SEARCH_ALIAS_GROUPS.map((group) => group.slice());
}

function searchTerms(query) {
  const tokens = new Set();
  const phrases = new Set();
  const normalizedQuery = normalizeSearchText(query);

  addSearchTerm(normalizedQuery, tokens, phrases);

  searchAliasGroups.forEach((group) => {
    const normalizedAliases = group.map(normalizeSearchText);
    const isAliasHit = normalizedAliases.some((alias) => {
      const aliasTokens = tokenizeSearchText(alias);
      return alias && (
        normalizedQuery.includes(alias) ||
        aliasTokens.every((token) => tokens.has(token))
      );
    });

    if (isAliasHit) {
      group.forEach((alias) => addSearchTerm(alias, tokens, phrases));
    }
  });

  return {
    tokens: [...tokens],
    phrases: [...phrases]
  };
}

function fieldMatchScore(value, terms, weight) {
  const text = normalizeSearchText(value);
  if (!text) return 0;

  const fieldTokens = new Set(tokenizeSearchText(text));
  const phraseScore = terms.phrases.reduce((total, phrase) => {
    return total + (text.includes(phrase) ? weight * 3 : 0);
  }, 0);
  const tokenScore = terms.tokens.reduce((total, token) => {
    if (fieldTokens.has(token)) return total + weight;
    return total + (text.includes(token) ? weight * 0.5 : 0);
  }, 0);

  return phraseScore + tokenScore;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanAttachmentUrl(url) {
  return String(url || "").replace(/[),.;]+$/g, "");
}

function googleDriveFileId(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return "";
    const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch) return filePathMatch[1];
    return parsed.searchParams.get("id") || "";
  } catch {
    return "";
  }
}

function imagePreviewUrl(url) {
  if (/^data:image\//i.test(url)) return url;
  const driveId = googleDriveFileId(url);
  if (driveId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url) ? url : "";
}

function parseAttachments(value) {
  const urlPattern = /https?:\/\/[^\s<>"']+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi;
  return String(value || "")
    .split(/\r?\n|\s+\|\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const urls = Array.from(line.matchAll(urlPattern), (match) => cleanAttachmentUrl(match[0]));
      if (!urls.length) return [{ type: "note", text: line }];

      return urls.map((url, index) => {
        const label = line
          .replace(url, "")
          .replace(/[()]/g, "")
          .replace(/^[\s\-:|]+|[\s\-:|]+$/g, "")
          .trim();
        const previewUrl = imagePreviewUrl(url);
        return {
          type: previewUrl ? "image" : "link",
          title: label || `Attachment ${index + 1}`,
          url,
          previewUrl
        };
      });
    });
}

function renderAttachments(value) {
  const attachments = parseAttachments(value);
  if (!attachments.length) return "";

  return `
    <div class="attachment-list">
      ${attachments.map((attachment) => {
        if (attachment.type === "note") {
          return `<p class="attachment-note">${escapeHtml(attachment.text)}</p>`;
        }

        if (attachment.type === "image") {
          return `
            <div class="attachment-item">
              <a class="attachment-image-frame" href="${escapeHtml(attachment.url)}">
                <img src="${escapeHtml(attachment.previewUrl)}" alt="${escapeHtml(attachment.title)}" loading="lazy" onerror="this.parentElement.classList.add('is-missing')">
                <span class="attachment-image-fallback">Preview unavailable. Open image.</span>
              </a>
              <a class="attachment-link" href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.title)}</a>
            </div>
          `;
        }

        return `
          <a class="attachment-link" href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.title)}</a>
        `;
      }).join("")}
    </div>
  `;
}

function usefulMetaValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const placeholder = normalize(text);
  if (placeholder === "from google sheet" || placeholder === "imported csv" || placeholder === "google sheet") {
    return "";
  }
  return text;
}

function formatMetaDate(value) {
  const text = usefulMetaValue(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function recordReviewText(record) {
  const lastUpdated = formatMetaDate(record.updatedAt || record.reviewed) || "Not listed";
  const reviewedBy = usefulMetaValue(record.reviewedBy) || usefulMetaValue(record.updatedBy) || "Not listed";
  return `Last updated: ${lastUpdated} | Reviewed by: ${reviewedBy}`;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/\||\n+/)
    .map((item) => item.trim().replace(/^(?:\d+[\).]|[-*])\s*/, ""))
    .filter(Boolean);
}

function recordText(record) {
  return [
    record.title,
    record.department,
    record.system,
    record.severity,
    record.keywords,
    record.issues,
    record.solution,
    record.steps.join(" "),
    record.moreInfo,
    record.attachments,
    record.relatedKbs,
    record.escalation,
    record.owner
  ].join(" ");
}

function score(record) {
  const query = fields.query.value;
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const terms = searchTerms(query);
  if (!terms.tokens.length && !terms.phrases.length) return 0;

  const title = normalizeSearchText(record.title);
  const keywords = normalizeSearchText(record.keywords);
  const fullText = normalizeSearchText(recordText(record));
  let total = 0;

  total += fieldMatchScore(record.title, terms, 10);
  total += fieldMatchScore(record.keywords, terms, 8);
  total += fieldMatchScore(record.issues, terms, 6);
  total += fieldMatchScore(record.solution, terms, 5);
  total += fieldMatchScore(record.steps.join(" "), terms, 4);
  total += fieldMatchScore(record.moreInfo, terms, 3);
  total += fieldMatchScore(record.relatedKbs, terms, 3);
  total += fieldMatchScore(record.attachments, terms, 2);
  total += fieldMatchScore([record.department, record.system, record.escalation].join(" "), terms, 1);

  if (title.includes(normalizedQuery)) total += 30;
  if (keywords.includes(normalizedQuery)) total += 18;
  if (fullText.includes(normalizedQuery)) total += 8;

  const originalTokens = tokenizeSearchText(query);
  const fullTextTokens = new Set(tokenizeSearchText(fullText));
  if (originalTokens.length && originalTokens.every((token) => fullTextTokens.has(token))) {
    total += 12;
  }

  return total;
}

function filteredRecords() {
  return records
    .filter((record) => fields.department.value === "all" || record.department === fields.department.value)
    .filter((record) => fields.system.value === "all" || record.system === fields.system.value)
    .map((record) => ({ record, score: score(record) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
}

function draftKey(draft) {
  return `${draft.draftId}:${draft.version || 0}`;
}

function currentDraft() {
  if (!selectedDraftKey) return null;
  return drafts.find((draft) => draftKey(draft) === selectedDraftKey) || null;
}

function currentRecord() {
  if (editorMode === "draft") {
    return currentDraft()?.record || null;
  }
  if (draftPanelOpen) {
    return null;
  }
  return records.find((record) => record.id === selectedId) || records[0];
}

function clearPendingDraftAction() {
  pendingDraftAction = "";
  pendingDraftActionExpires = 0;
}

function enterDraftWorkspace(selectKey = "") {
  draftPanelOpen = true;
  selectedDraftKey = selectKey || (currentDraft() ? selectedDraftKey : (drafts[0] ? draftKey(drafts[0]) : ""));
  selectedId = "";
  editorMode = "draft";
  editorOpen = false;
  clearPendingDraftAction();
}

function enterRecordWorkspace(recordId = "") {
  draftPanelOpen = false;
  selectedDraftKey = "";
  selectedId = recordId || selectedId || records[0]?.id || "";
  editorMode = "record";
  editorOpen = false;
  clearPendingDraftAction();
}

function selectValues(select) {
  return [...select.options]
    .map((option) => option.value)
    .filter((value) => value && value !== "all");
}

function selectedFilterValue(select, fallback) {
  return select.value && select.value !== "all" ? select.value : fallback;
}

function blankDraftRecord() {
  const serviceFallback = selectValues(fields.department)[0] || "Service Desk (Stern)";
  const escalationFallback = selectValues(fields.system)[0] || "No escalation listed";
  const department = selectedFilterValue(fields.department, serviceFallback);
  const system = selectedFilterValue(fields.system, escalationFallback);

  return normalizeBackendRecord({
    id: crypto.randomUUID(),
    title: "Untitled draft",
    department,
    system,
    severity: "Low",
    keywords: "",
    issues: "",
    solution: "",
    steps: [],
    escalation: system,
    owner: department,
    reviewed: "Draft",
    source: "",
    moreInfo: "",
    attachments: "",
    relatedKbs: "",
    status: "Draft"
  });
}

function createLocalDraft() {
  const now = new Date().toISOString();
  const draft = {
    draftId: crypto.randomUUID(),
    recordId: "",
    version: 0,
    status: "Unsaved Draft",
    createdAt: now,
    createdBy: "",
    updatedAt: now,
    updatedBy: "",
    publishedAt: "",
    publishedRecordId: "",
    isUnsaved: true,
    record: blankDraftRecord()
  };
  drafts = [draft, ...drafts];
  selectedDraftKey = draftKey(draft);
  selectedId = "";
  editorMode = "draft";
  draftPanelOpen = true;
  editorOpen = true;
  clearPendingDraftAction();
  render();
}

function rememberSavedDraft(savedDraft) {
  drafts = [
    savedDraft,
    ...drafts.filter((draft) => {
      if (draft.isUnsaved && draft.draftId === savedDraft.draftId) return false;
      return draftKey(draft) !== draftKey(savedDraft);
    })
  ];
  selectedDraftKey = draftKey(savedDraft);
}

function isDraftActionArmed(action, draft) {
  return pendingDraftAction === `${action}:${draftKey(draft)}` && Date.now() < pendingDraftActionExpires;
}

function requireDraftActionConfirmation(action, draft) {
  if (isDraftActionArmed(action, draft)) {
    pendingDraftAction = "";
    pendingDraftActionExpires = 0;
    return true;
  }

  pendingDraftAction = `${action}:${draftKey(draft)}`;
  pendingDraftActionExpires = Date.now() + 6000;
  render();
  return false;
}

function fillSelect(select, values) {
  const current = select.value || "all";
  select.innerHTML = '<option value="all">All</option>';
  [...new Set(values)].sort().forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = [...select.options].some((option) => option.value === current) ? current : "all";
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function editorOptionValues(key, fallback) {
  if (key === "department") return uniqueValues([fallback, ...selectValues(fields.department)]);
  if (key === "system") return uniqueValues([fallback, ...selectValues(fields.system)]);
  const recordValues = records.map((record) => record[key]);
  const draftValues = drafts.map((draft) => draft.record?.[key]);
  return uniqueValues([fallback, ...recordValues, ...draftValues]);
}

function fillEditorSelect(select, values, currentValue) {
  const options = uniqueValues([currentValue, ...values]);
  select.innerHTML = "";
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = options.includes(currentValue) ? currentValue : (options[0] || "");
}

function recommendedOutputMode(record) {
  const solution = record.solution || "";
  const text = normalize([record.title, record.issues, record.solution, record.moreInfo].join(" "));
  const steps = record.steps || [];
  const hasNumberedSteps = /(^|\n)\s*(?:\d+[\).]|[-*])\s+/.test(solution);
  const routingAnswer = /(does not manage|reach out|contact|e-mail|email|phone|call|refer|escalate to)/.test(text);
  const actionTerms = [
    "download",
    "install",
    "configure",
    "verify",
    "confirm",
    "reset",
    "restart",
    "upload",
    "log out",
    "log in",
    "sign in",
    "select",
    "open",
    "click",
    "submit",
    "remove"
  ];
  const actionCount = actionTerms.filter((term) => text.includes(term)).length;

  if (hasNumberedSteps && steps.length >= 3) return "sop";
  if (steps.length >= 4) return "sop";
  if (steps.length >= 3 && actionCount >= 2) return "sop";
  if (solution.length > 320 && steps.length >= 2 && !routingAnswer) return "sop";
  return "solution";
}

function activeOutputMode(record) {
  return fields.outputMode.value === "auto" ? recommendedOutputMode(record) : fields.outputMode.value;
}

function outputModeLabel(mode) {
  if (mode === "sop") return "SOP";
  if (mode === "checklist") return "Checklist";
  return "Solution";
}

function displayRelatedKbs(record) {
  const value = String(record.relatedKbs || "").trim();
  return normalize(value) === "google sheet" ? "" : value;
}

function usefulEscalationValue(record) {
  const value = String(record.escalation || record.system || "").trim();
  const normalized = normalize(value).replace(/[.]+$/g, "");
  if (!normalized || normalized === "no escalation listed") return "";
  return value;
}

function renderResults(matches) {
  fields.results.innerHTML = "";
  fields.matchCount.textContent = `${matches.length} ${matches.length === 1 ? "record" : "records"}`;
  const hasInquiry = normalize(fields.query.value).length > 0;
  fields.results.classList.toggle("empty-inquiry", !hasInquiry);

  if (!draftPanelOpen && !matches.some((item) => item.record.id === selectedId) && matches.length) {
    selectedId = matches[0].record.id;
  }

  if (!matches.length) {
    fields.results.innerHTML = '<div class="result"><h3>No match found</h3><p>Try fewer filters or broader wording.</p></div>';
    return;
  }

  matches.forEach(({ record }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `result${record.id === selectedId ? " active" : ""}`;
    button.innerHTML = `
      <h3>${escapeHtml(record.title)}</h3>
      <p>${escapeHtml(record.solution || record.issues || record.moreInfo)}</p>
    `;
    button.addEventListener("click", () => {
      enterRecordWorkspace(record.id);
      render();
    });
    fields.results.appendChild(button);
  });
}

function draftVersionLabel(draft) {
  return draft.isUnsaved ? "Unsaved" : `v${draft.version || 1}`;
}

function draftUpdatedText(draft) {
  const updated = formatMetaDate(draft.updatedAt) || "Not saved yet";
  const editor = usefulMetaValue(draft.updatedBy) || usefulMetaValue(draft.createdBy);
  return editor ? `${updated} by ${editor}` : updated;
}

function renderDrafts() {
  if (!fields.draftsPanel || !fields.draftList) return;

  fields.draftsPanel.classList.toggle("hidden", !draftPanelOpen);
  fields.resultsPanel.classList.toggle("hidden", draftPanelOpen);
  if (fields.toggleDrafts) {
    fields.toggleDrafts.textContent = draftPanelOpen ? "Records" : "Drafts";
  }

  fields.draftCount.textContent = `${drafts.length} ${drafts.length === 1 ? "version" : "versions"}`;
  fields.draftList.innerHTML = "";

  if (!drafts.length) {
    fields.draftList.innerHTML = '<div class="draft-empty">No drafts yet.</div>';
    return;
  }

  drafts.forEach((draft) => {
    const button = document.createElement("button");
    const record = draft.record || {};
    button.type = "button";
    button.className = `draft-card${draftKey(draft) === selectedDraftKey ? " active" : ""}`;
    button.innerHTML = `
      <div class="draft-card-head">
        <h3>${escapeHtml(record.title || "Untitled draft")}</h3>
        <span class="draft-pill">${escapeHtml(draftVersionLabel(draft))}</span>
      </div>
      <p>${escapeHtml(record.solution || record.issues || record.moreInfo || "No draft details entered yet.")}</p>
      <div class="draft-card-meta">
        <span>${escapeHtml(draft.status || "Draft")}</span>
        <span>${escapeHtml(draftUpdatedText(draft))}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      enterDraftWorkspace(draftKey(draft));
      render();
    });
    fields.draftList.appendChild(button);
  });
}

function renderAnswer(record) {
  const draft = editorMode === "draft" ? currentDraft() : null;
  const isPublishedDraft = normalize(draft?.status) === "published";
  const canPublishDraft = Boolean(draft && !draft.isUnsaved && !isPublishedDraft && dataMode === "google-sheet");

  fields.publishDraft.classList.toggle("hidden", !canPublishDraft);
  fields.deleteDraft.classList.toggle("hidden", !draft);
  if (draft) {
    fields.publishDraft.textContent = isDraftActionArmed("publish", draft) ? "Confirm Publish" : "Publish Draft";
    fields.deleteDraft.textContent = isDraftActionArmed("delete", draft)
      ? "Confirm Delete"
      : (draft.isUnsaved ? "Discard Draft" : "Delete Draft");
  }
  fields.toggleEditor.textContent = draft ? "Edit Draft" : "Edit Record";
  fields.toggleEditor.classList.toggle("hidden", !record);

  if (!record) {
    fields.title.textContent = "No record selected";
    fields.meta.textContent = draftPanelOpen ? "Select a draft or create a new one." : "Source pending";
    fields.reviewMeta.textContent = "Last updated pending";
    fields.answer.innerHTML = "";
    return;
  }

  const recommendedMode = recommendedOutputMode(record);
  const displayMode = activeOutputMode(record);
  const outputNote = fields.outputMode.value === "auto"
    ? `Best fit: ${outputModeLabel(displayMode)}`
    : `Suggested: ${outputModeLabel(recommendedMode)}`;

  fields.title.textContent = record.title;
  fields.meta.textContent = draft
    ? `${draft.status || "Draft"} | ${draftVersionLabel(draft)} | ${record.department || "General"} | ${outputNote}`
    : `${record.department} | ${record.system || "No escalation listed"} | ${outputNote}`;
  fields.reviewMeta.textContent = draft
    ? `Last updated: ${formatMetaDate(draft.updatedAt) || "Not saved yet"} | Reviewed by: ${usefulMetaValue(draft.updatedBy) || "Not listed"}`
    : recordReviewText(record);
  const relatedKbs = displayRelatedKbs(record);
  const usefulEscalation = usefulEscalationValue(record);
  const attachmentsHtml = record.attachments ? renderAttachments(record.attachments) : "";

  if (displayMode === "solution") {
    fields.answer.innerHTML = `
      ${record.issues ? `
      <section class="answer-block">
        <h3>Main Issue</h3>
        <p class="prewrap">${escapeHtml(record.issues)}</p>
      </section>
      ` : ""}
      ${record.solution || !draft ? `
      <section class="answer-block">
        <h3>Resolution</h3>
        <p class="prewrap">${escapeHtml(record.solution || "No resolution listed.")}</p>
      </section>
      ` : ""}
      ${record.moreInfo ? `
      <section class="answer-block">
        <h3>More Information</h3>
        <p class="prewrap">${escapeHtml(record.moreInfo)}</p>
      </section>
      ` : ""}
      ${record.attachments ? `
      <section class="answer-block">
        <h3>Attachments / Images</h3>
        ${attachmentsHtml}
      </section>
      ` : ""}
      ${usefulEscalation || !draft ? `
      <section class="answer-block">
        <h3>Escalation</h3>
        <p class="prewrap">${escapeHtml(usefulEscalation || "No escalation listed.")}</p>
      </section>
      ` : ""}
      ${relatedKbs ? `
      <section class="answer-block">
        <h3>Related KBs</h3>
        <p class="prewrap">${escapeHtml(relatedKbs)}</p>
      </section>
      ` : ""}
    `;
  }

  if (displayMode === "checklist") {
    fields.answer.innerHTML = `
      ${record.steps.length || !draft ? `
      <section class="answer-block">
        <h3>Checklist</h3>
        <div class="checklist">
          ${record.steps.map((step, index) => `
            <label class="checkline">
              <input type="checkbox">
              <span>${index + 1}. ${escapeHtml(step)}</span>
            </label>
          `).join("")}
        </div>
      </section>
      ` : ""}
      ${record.attachments ? `
      <section class="answer-block">
        <h3>Attachments / Images</h3>
        ${attachmentsHtml}
      </section>
      ` : ""}
    `;
  }

  if (displayMode === "sop") {
    fields.answer.innerHTML = `
      ${record.issues || record.solution || !draft ? `
      <section class="answer-block">
        <h3>Purpose</h3>
        <p class="prewrap">${escapeHtml(record.issues || record.solution || record.title)}</p>
      </section>
      ` : ""}
      ${record.steps.length || !draft ? `
      <section class="answer-block">
        <h3>Procedure</h3>
        <ol class="steps">
          ${record.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </section>
      ` : ""}
      ${record.moreInfo || !draft ? `
      <section class="answer-block">
        <h3>Reference Notes</h3>
        <p class="prewrap">${escapeHtml(record.moreInfo || "No additional notes listed.")}</p>
      </section>
      ` : ""}
      ${record.attachments ? `
      <section class="answer-block">
        <h3>Attachments / Images</h3>
        ${attachmentsHtml}
      </section>
      ` : ""}
      ${usefulEscalation || !draft ? `
      <section class="answer-block">
        <h3>Escalation</h3>
        <p class="prewrap">${escapeHtml(usefulEscalation || "No escalation listed.")}</p>
      </section>
      ` : ""}
      ${relatedKbs || !draft ? `
      <section class="answer-block">
        <h3>Related KBs</h3>
        <p class="prewrap">${escapeHtml(relatedKbs || "No related KBs listed.")}</p>
      </section>
      ` : ""}
    `;
  }
}

function renderEditor(record) {
  const submitButton = fields.editor.querySelector("button[type='submit']");
  if (submitButton) {
    submitButton.textContent = editorMode === "draft"
      ? "Save Draft Version"
      : (dataMode === "google-sheet" ? "Save Record" : "Save Draft");
  }
  const showEditor = editorOpen && Boolean(record);
  fields.editor.classList.toggle("hidden", !showEditor);
  if (!showEditor) return;
  fillEditorSelect(
    fields.editor.elements.department,
    editorOptionValues("department", "Service Desk (Stern)"),
    record.department || "Service Desk (Stern)"
  );
  fillEditorSelect(
    fields.editor.elements.system,
    editorOptionValues("system", "No escalation listed"),
    record.system || record.escalation || "No escalation listed"
  );
  fields.editor.elements.title.value = record.title;
  fields.editor.elements.department.value = record.department || "Service Desk (Stern)";
  fields.editor.elements.system.value = record.system || record.escalation || "No escalation listed";
  fields.editor.elements.source.value = record.source;
  fields.editor.elements.issues.value = record.issues || "";
  fields.editor.elements.solution.value = record.solution || record.steps.join("\n");
  fields.editor.elements.moreInfo.value = record.moreInfo || "";
  fields.editor.elements.attachments.value = record.attachments || "";
}

function applyEditorValues(record) {
  record.title = fields.editor.elements.title.value.trim() || "Untitled draft";
  record.department = fields.editor.elements.department.value.trim() || "General";
  record.system = fields.editor.elements.system.value.trim() || "No escalation listed";
  record.source = fields.editor.elements.source.value.trim();
  record.issues = fields.editor.elements.issues.value.trim();
  record.solution = fields.editor.elements.solution.value.trim();
  record.steps = asList(record.solution.replaceAll("\n", "|"));
  record.moreInfo = fields.editor.elements.moreInfo.value.trim();
  record.attachments = fields.editor.elements.attachments.value.trim();
  record.escalation = record.system;
  record.owner = record.department;
  record.relatedKbs = record.source;
  record.reviewed = record.reviewed || "Draft";
  return record;
}

function render() {
  fillSelect(fields.department, records.map((record) => record.department));
  fillSelect(fields.system, records.map((record) => record.system));
  const matches = filteredRecords();
  renderResults(matches);
  renderDrafts();
  const record = currentRecord();
  renderAnswer(record);
  renderEditor(record);
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...data] = rows.filter((items) => items.some((item) => item.trim()));
  if (!headers) return [];
  const keys = headers.map((header) => normalize(header).replace(/[^a-z0-9]/g, ""));

  return data.map((items, index) => {
    const rowObject = {};
    keys.forEach((key, cellIndex) => {
      rowObject[key] = cleanText(items[cellIndex] || "");
    });
    const title = firstValue(rowObject, ["title", "topic"]) || "Untitled record";
    const service = firstValue(rowObject, ["department", "universityservice", "service"]) || "General";
    const escalationRoute = firstValue(rowObject, ["system", "escalation"]) || "No escalation listed";
    const issues = firstValue(rowObject, ["issues", "mainissues", "symptoms"]) || "";
    const resolution = firstValue(rowObject, ["solution", "resolution"]) || "";
    const moreInfo = firstValue(rowObject, ["moreinformation", "moreinfo", "notes"]) || "";
    const attachments = firstValue(rowObject, ["attachmentsimages", "attachments", "images"]) || "";
    const relatedKbs = firstValue(rowObject, ["relatedkbs", "relatedkb", "source", "sourcedoc"]) || "";
    const keywords = [
      firstValue(rowObject, ["keywords", "tags"]),
      issues,
      relatedKbs,
      moreInfo
    ].filter(Boolean).join(" ");
    const rawSteps = firstValue(rowObject, ["steps", "sopsteps"]) || resolution;

    return {
      id: firstValue(rowObject, ["id"]) || `CSV-${index + 1}`,
      title,
      department: service,
      system: escalationRoute,
      severity: firstValue(rowObject, ["severity"]) || (escalationRoute === "No escalation listed" ? "Low" : "Medium"),
      keywords,
      issues,
      solution: resolution || issues || moreInfo,
      steps: asList(rawSteps),
      escalation: escalationRoute,
      owner: firstValue(rowObject, ["owner"]) || service,
      reviewed: firstValue(rowObject, ["reviewed", "lastreviewed"]) || "Imported CSV",
      updatedAt: firstValue(rowObject, ["updatedat", "lastupdated"]) || "",
      updatedBy: firstValue(rowObject, ["updatedby", "reviewedby"]) || "",
      reviewedBy: firstValue(rowObject, ["reviewedby", "updatedby"]) || "",
      source: relatedKbs || "Topics CSV",
      moreInfo,
      attachments,
      relatedKbs
    };
  });
}

function cleanText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function firstValue(rowObject, keys) {
  for (const key of keys) {
    if (rowObject[key]) return rowObject[key];
  }
  return "";
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value || "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportRows() {
  const headers = ["id", "title", "department", "system", "severity", "keywords", "issues", "solution", "steps", "moreInfo", "attachments", "relatedKbs", "escalation", "owner", "reviewed", "updatedAt", "updatedBy", "reviewedBy", "source"];
  return [
    headers.join(","),
    ...records.map((record) => headers.map((key) => csvEscape(record[key])).join(","))
  ].join("\n");
}

function downloadCsv() {
  const blob = new Blob([exportRows()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "stern-it-service-desk-export.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadInitialData() {
  if (backendEnabled) {
    try {
      setDataStatus("Google Sheet mode", "ok");
      records = await loadBackendRecords();
      dataMode = "google-sheet";
      selectedId = records[0]?.id || "";
      render();
      return;
    } catch (error) {
      console.error(error);
      setDataStatus("Sheet unavailable - CSV fallback", "error");
    }
  } else {
    setDataStatus("CSV mode", "warning");
  }

  try {
    const response = await fetch("knowledge.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("CSV not available");
    records = parseCsv(await response.text());
  } catch {
    records = structuredClone(fallbackRecords);
  }
  drafts = [];
  selectedId = records[0]?.id || "";
  render();
}

function resetSelectionAndRender() {
  selectedId = "";
  selectedDraftKey = "";
  editorMode = "record";
  editorOpen = false;
  pendingDraftAction = "";
  pendingDraftActionExpires = 0;
  render();
}

fields.query.addEventListener("input", resetSelectionAndRender);
fields.department.addEventListener("input", resetSelectionAndRender);
fields.system.addEventListener("input", resetSelectionAndRender);
fields.outputMode.addEventListener("input", render);

document.querySelector("#clearQuery").addEventListener("click", () => {
  fields.query.value = "";
  resetSelectionAndRender();
});

fields.newDraft.addEventListener("click", createLocalDraft);

fields.toggleDrafts.addEventListener("click", () => {
  if (draftPanelOpen) {
    enterRecordWorkspace();
  } else {
    enterDraftWorkspace();
  }
  render();
});

fields.toggleEditor.addEventListener("click", () => {
  editorOpen = !editorOpen;
  render();
});

document.querySelector("#closeEditor").addEventListener("click", () => {
  editorOpen = false;
  render();
});

fields.editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = currentDraft();
  const record = currentRecord();
  if (!record) return;
  const submitButton = fields.editor.querySelector("button[type='submit']");
  const savingDraft = editorMode === "draft";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = savingDraft ? "Saving Draft..." : (dataMode === "google-sheet" ? "Saving..." : "Saving Draft...");
  }

  applyEditorValues(record);

  try {
    if (savingDraft) {
      if (!draft) throw new Error("No draft is selected.");

      if (dataMode === "google-sheet") {
        const savedDraft = await saveDraftToBackend({
          ...draft,
          recordId: draft.recordId || record.id,
          record
        });
        rememberSavedDraft(savedDraft);
        setDataStatus("Draft version saved to Google Sheet", "ok");
      } else {
        const savedDraft = {
          ...draft,
          version: draft.isUnsaved ? 1 : Number(draft.version || 0) + 1,
          status: "Local Draft",
          updatedAt: new Date().toISOString(),
          isUnsaved: false,
          record: structuredClone(record)
        };
        rememberSavedDraft(savedDraft);
        setDataStatus("Draft saved locally", "warning");
      }
    } else if (dataMode === "google-sheet") {
      const savedRecord = await saveRecordToBackend(record);
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) records[index] = savedRecord;
      selectedId = savedRecord.id;
      setDataStatus("Saved to Google Sheet", "ok");
    } else {
      setDataStatus("Draft saved locally", "warning");
    }
    editorOpen = false;
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Save failed", "error");
    alert(`Unable to save this record: ${error.message}`);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = editorMode === "draft"
        ? "Save Draft Version"
        : (dataMode === "google-sheet" ? "Save Record" : "Save Draft");
    }
  }
});

fields.publishDraft.addEventListener("click", async () => {
  const draft = currentDraft();
  if (!draft || draft.isUnsaved) return;
  if (!requireDraftActionConfirmation("publish", draft)) return;

  try {
    setDataStatus("Publishing draft...", "warning");
    const publishedRecord = await publishDraftToBackend(draft.draftId, draft.version);
    const index = records.findIndex((record) => record.id === publishedRecord.id);
    if (index >= 0) {
      records[index] = publishedRecord;
    } else {
      records = [publishedRecord, ...records];
    }
    await loadBackendDrafts();
    enterRecordWorkspace(publishedRecord.id);
    setDataStatus("Draft published to records", "ok");
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Publish failed", "error");
    alert(`Unable to publish this draft: ${error.message}`);
  }
});

fields.deleteDraft.addEventListener("click", async () => {
  const draft = currentDraft();
  if (!draft) return;
  if (!requireDraftActionConfirmation("delete", draft)) return;

  try {
    if (draft.isUnsaved || dataMode !== "google-sheet") {
      drafts = drafts.filter((item) => item.draftId !== draft.draftId);
      setDataStatus("Draft discarded", "warning");
    } else {
      setDataStatus("Deleting draft...", "warning");
      await deleteDraftFromBackend(draft.draftId);
      drafts = drafts.filter((item) => item.draftId !== draft.draftId);
      setDataStatus("Draft deleted from Google Sheet", "ok");
    }

    selectedDraftKey = drafts[0] ? draftKey(drafts[0]) : "";
    editorMode = "draft";
    selectedId = "";
    editorOpen = false;
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Delete failed", "error");
    alert(`Unable to delete this draft: ${error.message}`);
  }
});

document.querySelector("#csvUpload").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const imported = parseCsv(await file.text());
  if (!imported.length) return;

  if (dataMode === "google-sheet") {
    const confirmed = confirm("Replace all Google Sheet records with this CSV import? This will write an audit log entry.");
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      setDataStatus("Importing to Google Sheet...", "warning");
      records = await replaceBackendRecords(imported);
      setDataStatus("CSV imported to Google Sheet", "ok");
    } catch (error) {
      console.error(error);
      setDataStatus("Import failed", "error");
      alert(`Unable to import CSV to Google Sheet: ${error.message}`);
      return;
    }
  } else {
    records = imported;
    setDataStatus("CSV imported locally", "warning");
  }

  selectedId = records[0].id;
  selectedDraftKey = "";
  editorMode = "record";
  editorOpen = false;
  pendingDraftAction = "";
  pendingDraftActionExpires = 0;
  render();
});

document.querySelector("#exportCsv").addEventListener("click", downloadCsv);

loadInitialData();
