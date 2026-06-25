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
let deletedRecords = [];
let selectedId = "";
let selectedDraftKey = "";
let selectedRecoveryKey = "";
let editorOpen = false;
let draftPanelOpen = false;
let recoveryPanelOpen = false;
let editorMode = "record";
let dataMode = "csv";
let pendingDraftAction = "";
let pendingDraftActionExpires = 0;
let pendingRecordAction = "";
let pendingRecordActionExpires = 0;
let pendingViewTimer = 0;
let pendingViewKey = "";
let pendingResultFocusId = "";
let archiveReasonRecordId = "";
let archiveReasonText = "";
const DRAFT_AUTOSAVE_DELAY = 1800;
let draftAutosaveTimer = 0;
let draftAutosaveInFlight = false;
let draftAutosaveQueued = false;
let lastDraftAutosaveSignature = "";
let activeConfirmDialog = null;
const trackedRecordViews = new Map();

const appConfig = window.APP_CONFIG || {};
const appsScriptUrl = String(appConfig.APPS_SCRIPT_URL || "").trim();
const backendEnabled = /^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/[^/]+\/s)\/.+\/exec$/.test(appsScriptUrl);
const BACKEND_CACHE_KEY = "stern-it-service-desk:backend-cache:v1";
const BACKEND_CACHE_VERSION = 1;

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
  recoveryPanel: document.querySelector("#recoveryPanel"),
  recoveryList: document.querySelector("#recoveryList"),
  recoveryCount: document.querySelector("#recoveryCount"),
  newDraft: document.querySelector("#newDraft"),
  toggleDrafts: document.querySelector("#toggleDrafts"),
  toggleRecovery: document.querySelector("#toggleRecovery"),
  publishDraft: document.querySelector("#publishDraft"),
  deleteDraft: document.querySelector("#deleteDraft"),
  archiveRecord: document.querySelector("#archiveRecord"),
  deleteRecord: document.querySelector("#deleteRecord"),
  restoreRecord: document.querySelector("#restoreRecord"),
  toggleEditor: document.querySelector("#toggleEditor"),
  archiveReasonPanel: document.querySelector("#archiveReasonPanel"),
  archiveReasonInput: document.querySelector("#archiveReason"),
  cancelArchiveReason: document.querySelector("#cancelArchiveReason"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmDialogTitle: document.querySelector("#confirmDialogTitle"),
  confirmDialogBody: document.querySelector("#confirmDialogBody"),
  cancelConfirmDialog: document.querySelector("#cancelConfirmDialog"),
  confirmDialogAction: document.querySelector("#confirmDialogAction")
};

function setDataStatus(text, state = "ok") {
  if (!fields.dataStatus) return;
  fields.dataStatus.textContent = text;
  fields.dataStatus.classList.toggle("warning", state === "warning");
  fields.dataStatus.classList.toggle("error", state === "error");
}

function closeConfirmDialog(confirmed = false) {
  if (!activeConfirmDialog) return;
  const { resolve, returnFocus } = activeConfirmDialog;
  activeConfirmDialog = null;
  fields.confirmDialog?.classList.add("hidden");
  resolve(confirmed);
  window.requestAnimationFrame(() => returnFocus?.focus?.());
}

function openConfirmDialog({ title, body, confirmText = "Confirm", danger = true }) {
  if (!fields.confirmDialog) return Promise.resolve(window.confirm(body || title || "Confirm this action?"));

  if (activeConfirmDialog) closeConfirmDialog(false);

  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  fields.confirmDialogTitle.textContent = title;
  fields.confirmDialogBody.textContent = body;
  fields.confirmDialogAction.textContent = confirmText;
  fields.confirmDialogAction.className = danger ? "button danger" : "button";
  fields.confirmDialog.classList.remove("hidden");

  return new Promise((resolve) => {
    activeConfirmDialog = { resolve, returnFocus };
    window.requestAnimationFrame(() => fields.cancelConfirmDialog?.focus());
  });
}

function confirmFocusTargets() {
  if (!fields.confirmDialog || fields.confirmDialog.classList.contains("hidden")) return [];
  return [fields.cancelConfirmDialog, fields.confirmDialogAction].filter((item) => item && !item.disabled);
}

function renderLoadingState() {
  fields.matchCount.textContent = "Loading records";
  fields.results.classList.remove("empty-inquiry");
  fields.results.innerHTML = `
    <div class="result loading-result" aria-live="polite">
      <h3>Loading records</h3>
      <p>Fetching the latest Google Sheet data.</p>
    </div>
  `;
  fields.title.textContent = "Loading records";
  fields.meta.textContent = "Please wait while the knowledge base refreshes.";
  fields.reviewMeta.textContent = "";
  fields.answer.innerHTML = "";
  fields.editor.classList.add("hidden");
}

function readBackendCache() {
  try {
    const rawCache = localStorage.getItem(BACKEND_CACHE_KEY);
    if (!rawCache) return null;

    const cache = JSON.parse(rawCache);
    if (cache.version !== BACKEND_CACHE_VERSION || !Array.isArray(cache.records) || !cache.records.length) {
      return null;
    }

    return {
      cachedAt: cache.cachedAt || "",
      records: cache.records.map(normalizeBackendRecord),
      drafts: Array.isArray(cache.drafts) ? cache.drafts.map(normalizeBackendDraft) : [],
      deletedRecords: Array.isArray(cache.deletedRecords) ? cache.deletedRecords.map(normalizeDeletedRecord) : [],
      searchAliasGroups: normalizeSearchSynonymGroups(cache.searchAliasGroups)
    };
  } catch (error) {
    console.warn("Cached records could not be read.", error);
    return null;
  }
}

function writeBackendCache() {
  if (!backendEnabled || dataMode !== "google-sheet" || !records.length) return;

  try {
    localStorage.setItem(BACKEND_CACHE_KEY, JSON.stringify({
      version: BACKEND_CACHE_VERSION,
      cachedAt: new Date().toISOString(),
      records,
      drafts,
      deletedRecords,
      searchAliasGroups
    }));
  } catch (error) {
    console.warn("Records could not be cached locally.", error);
  }
}

function applyBackendCache(cache) {
  records = cache.records;
  drafts = cache.drafts;
  deletedRecords = cache.deletedRecords;
  searchAliasGroups = cache.searchAliasGroups.length
    ? cache.searchAliasGroups
    : DEFAULT_SEARCH_ALIAS_GROUPS.map((group) => group.slice());
  dataMode = "google-sheet";
  selectedId = activeRecords().some((record) => record.id === selectedId)
    ? selectedId
    : (activeRecords()[0]?.id || "");
  render();

  const cacheDate = formatMetaDate(cache.cachedAt);
  setDataStatus(cacheDate ? `Ready - refreshing from ${cacheDate}` : "Ready - refreshing", "warning");
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
    reviewedBy: record.reviewedBy || record.updatedBy || "",
    archiveReason: record.archiveReason || "",
    deletedAt: record.deletedAt || "",
    deletedBy: record.deletedBy || ""
  };
}

function normalizeDeletedRecord(record) {
  const normalized = normalizeBackendRecord(record);
  return {
    ...normalized,
    status: "Deleted",
    deletedAt: record.deletedAt || normalized.deletedAt || "",
    deletedBy: record.deletedBy || normalized.deletedBy || ""
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
  deletedRecords = (data.deletedRecords || []).map(normalizeDeletedRecord);
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

async function autosaveDraftToBackend(draft) {
  const data = await backendRequest({
    action: "autosaveDraft",
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

async function archiveRecordInBackend(recordId, archiveReason) {
  const data = await backendRequest({
    action: "archiveRecord",
    recordId,
    archiveReason
  });
  return normalizeBackendRecord(data.record || {});
}

async function deleteRecordInBackend(recordId) {
  const data = await backendRequest({
    action: "deleteRecord",
    recordId
  });
  return normalizeDeletedRecord(data.deleted || {});
}

async function restoreArchivedRecordInBackend(recordId) {
  const data = await backendRequest({
    action: "restoreArchivedRecord",
    recordId
  });
  return normalizeBackendRecord(data.record || {});
}

async function restoreDeletedRecordInBackend(recordId) {
  const data = await backendRequest({
    action: "restoreDeletedRecord",
    recordId
  });
  return normalizeBackendRecord(data.record || {});
}

async function trackRecordViewInBackend(view) {
  const data = await backendRequest({
    action: "trackRecordView",
    view
  });
  return data.view || {};
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

function renderLinkedText(value) {
  const text = String(value || "");
  const linkPattern = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let rendered = "";
  let lastIndex = 0;

  text.replace(linkPattern, (match, offset) => {
    rendered += escapeHtml(text.slice(lastIndex, offset));

    const isEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(match);
    const linkedText = isEmail ? match : cleanAttachmentUrl(match);
    const trailingText = match.slice(linkedText.length);
    const href = isEmail
      ? `mailto:${linkedText}`
      : linkedText.startsWith("www.")
      ? `https://${linkedText}`
      : linkedText;
    const targetAttrs = isEmail ? "" : ' target="_blank" rel="noopener noreferrer"';

    rendered += `<a class="text-link" href="${escapeHtml(href)}"${targetAttrs}>${escapeHtml(linkedText)}</a>`;
    rendered += escapeHtml(trailingText);
    lastIndex = offset + match.length;
    return match;
  });

  rendered += escapeHtml(text.slice(lastIndex));
  return rendered;
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
              <a class="attachment-image-frame" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">
                <img src="${escapeHtml(attachment.previewUrl)}" alt="${escapeHtml(attachment.title)}" loading="lazy" onerror="this.parentElement.classList.add('is-missing')">
                <span class="attachment-image-fallback">Preview unavailable. Open image.</span>
              </a>
              <a class="attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.title)}</a>
            </div>
          `;
        }

        return `
          <a class="attachment-link" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.title)}</a>
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
  return searchableRecords()
    .filter((record) => fields.department.value === "all" || record.department === fields.department.value)
    .filter((record) => fields.system.value === "all" || record.system === fields.system.value)
    .map((record) => ({ record, score: score(record) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));
}

function isArchivedRecord(record) {
  return normalize(record?.status) === "archived";
}

function activeRecords() {
  return records.filter((record) => !isArchivedRecord(record));
}

function searchIncludesArchivedRecords() {
  return normalize(fields.query.value).length > 0;
}

function searchableRecords() {
  return searchIncludesArchivedRecords() ? records : activeRecords();
}

function archivedRecords() {
  return records.filter((record) => isArchivedRecord(record));
}

function recoveryRecordKey(type, recordId) {
  return `${type}:${recordId || ""}`;
}

function recoveryKey(item) {
  return recoveryRecordKey(item.recoveryType, item.record?.id);
}

function recoverySortTime(item) {
  const record = item.record || {};
  return Date.parse(record.deletedAt || record.updatedAt || record.reviewed || "") || 0;
}

function recoveryItems() {
  return [
    ...archivedRecords().map((record) => ({ recoveryType: "Archived", record })),
    ...deletedRecords.map((record) => ({ recoveryType: "Deleted", record }))
  ].sort((a, b) => recoverySortTime(b) - recoverySortTime(a) || (a.record?.title || "").localeCompare(b.record?.title || ""));
}

function recordViewSource(record) {
  if (editorMode === "recovery") return isArchivedRecord(record) ? "recovery-archived" : "recovery-deleted";
  if (editorMode === "draft") return "";
  if (isArchivedRecord(record)) return "search-archived";
  return fields.query.value.trim() ? "search" : "default";
}

function recordViewKey(record, source) {
  return `${record?.id || ""}:${record?.status || ""}:${source || ""}`;
}

function cancelPendingRecordView() {
  window.clearTimeout(pendingViewTimer);
  pendingViewTimer = 0;
  pendingViewKey = "";
}

function queueRecordView(record) {
  if (dataMode !== "google-sheet" || !record?.id || editorMode === "draft") {
    cancelPendingRecordView();
    return;
  }

  const source = recordViewSource(record);
  if (!source) {
    cancelPendingRecordView();
    return;
  }

  const viewKey = recordViewKey(record, source);
  const lastTracked = trackedRecordViews.get(viewKey) || 0;
  if (Date.now() - lastTracked < 5 * 60 * 1000) {
    cancelPendingRecordView();
    return;
  }

  cancelPendingRecordView();
  pendingViewKey = viewKey;
  pendingViewTimer = window.setTimeout(async () => {
    if (pendingViewKey !== viewKey) return;
    trackedRecordViews.set(viewKey, Date.now());

    try {
      await trackRecordViewInBackend({
        recordId: record.id,
        title: record.title,
        status: record.status || "Active",
        source,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.warn("Record view was not tracked.", error);
      trackedRecordViews.delete(viewKey);
    }
  }, 1000);
}

function currentRecoveryItem() {
  if (!recoveryPanelOpen) return null;
  const items = recoveryItems();
  return items.find((item) => recoveryKey(item) === selectedRecoveryKey) || items[0] || null;
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
  if (editorMode === "recovery") {
    return currentRecoveryItem()?.record || null;
  }
  if (draftPanelOpen) {
    return null;
  }
  const visibleRecords = searchableRecords();
  return visibleRecords.find((record) => record.id === selectedId) || visibleRecords[0] || null;
}

function clearPendingDraftAction() {
  pendingDraftAction = "";
  pendingDraftActionExpires = 0;
}

function clearPendingRecordAction() {
  pendingRecordAction = "";
  pendingRecordActionExpires = 0;
}

function clearDraftAutosave() {
  window.clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer = 0;
  draftAutosaveQueued = false;
}

function clearArchiveReason() {
  archiveReasonRecordId = "";
  archiveReasonText = "";
  if (fields.archiveReasonInput) {
    fields.archiveReasonInput.value = "";
    fields.archiveReasonInput.setCustomValidity("");
  }
}

function openArchiveReason(record) {
  if (!record?.id) return;
  archiveReasonRecordId = record.id;
  archiveReasonText = "";
  clearPendingRecordAction();
  setDataStatus("Archive reason required", "warning");
  render();
  window.requestAnimationFrame(() => fields.archiveReasonInput?.focus());
}

function enterDraftWorkspace(selectKey = "") {
  draftPanelOpen = true;
  recoveryPanelOpen = false;
  selectedDraftKey = selectKey || (currentDraft() ? selectedDraftKey : (drafts[0] ? draftKey(drafts[0]) : ""));
  selectedRecoveryKey = "";
  selectedId = "";
  editorMode = "draft";
  editorOpen = false;
  clearPendingDraftAction();
  clearPendingRecordAction();
  clearDraftAutosave();
  lastDraftAutosaveSignature = "";
  clearArchiveReason();
}

function enterRecordWorkspace(recordId = "") {
  draftPanelOpen = false;
  recoveryPanelOpen = false;
  selectedDraftKey = "";
  selectedRecoveryKey = "";
  selectedId = recordId || selectedId || activeRecords()[0]?.id || "";
  editorMode = "record";
  editorOpen = false;
  clearPendingDraftAction();
  clearPendingRecordAction();
  clearDraftAutosave();
  lastDraftAutosaveSignature = "";
  clearArchiveReason();
}

function enterRecoveryWorkspace(selectKey = "") {
  const items = recoveryItems();
  draftPanelOpen = false;
  recoveryPanelOpen = true;
  selectedDraftKey = "";
  selectedId = "";
  selectedRecoveryKey = selectKey || (items.some((item) => recoveryKey(item) === selectedRecoveryKey)
    ? selectedRecoveryKey
    : (items[0] ? recoveryKey(items[0]) : ""));
  editorMode = "recovery";
  editorOpen = false;
  clearPendingDraftAction();
  clearPendingRecordAction();
  clearDraftAutosave();
  lastDraftAutosaveSignature = "";
  clearArchiveReason();
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
  clearPendingRecordAction();
  clearDraftAutosave();
  lastDraftAutosaveSignature = "";
  render();
}

function rememberSavedDraft(savedDraft, selectSaved = true) {
  drafts = [
    savedDraft,
    ...drafts.filter((draft) => {
      if (draft.isUnsaved && draft.draftId === savedDraft.draftId) return false;
      return draftKey(draft) !== draftKey(savedDraft);
    })
  ];
  if (selectSaved) {
    selectedDraftKey = draftKey(savedDraft);
  }
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

function recordActionKey(action, record) {
  if (record?.recoveryType && record?.record) {
    return `${action}:${record.recoveryType}:${record.record.id || ""}`;
  }
  return `${action}:${record?.status || "record"}:${record?.id || ""}`;
}

function isRecordActionArmed(action, record) {
  return pendingRecordAction === recordActionKey(action, record) && Date.now() < pendingRecordActionExpires;
}

function requireRecordActionConfirmation(action, record) {
  if (isRecordActionArmed(action, record)) {
    clearPendingRecordAction();
    return true;
  }

  pendingRecordAction = recordActionKey(action, record);
  pendingRecordActionExpires = Date.now() + 6000;
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

function compactAccessibleText(value, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function resultAccessibleLabel(record, archived) {
  const parts = [`Open record: ${record.title || "Untitled record"}`];
  if (archived) parts.push("Archived");
  if (record.department) parts.push(`University Service: ${record.department}`);
  parts.push(`Escalation: ${usefulEscalationValue(record) || "No escalation listed"}`);
  const summary = compactAccessibleText(record.solution || record.issues || record.moreInfo);
  if (summary) parts.push(`Summary: ${summary}`);
  return parts.join(". ");
}

function resultButtons() {
  return Array.from(fields.results.querySelectorAll(".result[data-record-id]"));
}

function focusResultButton(recordId) {
  const button = resultButtons().find((item) => item.dataset.recordId === recordId);
  if (button) button.focus({ preventScroll: false });
}

function handleResultKeydown(event, currentRecordId) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const buttons = resultButtons();
  if (!buttons.length) return;

  event.preventDefault();
  let currentIndex = buttons.findIndex((button) => button.dataset.recordId === currentRecordId);
  if (currentIndex < 0) {
    currentIndex = buttons.findIndex((button) => button === document.activeElement);
  }
  if (currentIndex < 0) currentIndex = 0;

  let nextIndex = currentIndex;
  if (event.key === "ArrowDown") nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
  if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = buttons.length - 1;

  const nextRecordId = buttons[nextIndex]?.dataset.recordId;
  if (!nextRecordId) return;
  if (nextRecordId === selectedId) {
    buttons[nextIndex].focus();
    return;
  }

  pendingResultFocusId = nextRecordId;
  enterRecordWorkspace(nextRecordId);
  render();
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
    const archived = isArchivedRecord(record);
    const active = record.id === selectedId;
    button.type = "button";
    button.className = `result${archived ? " archived" : ""}${active ? " active" : ""}`;
    button.dataset.recordId = record.id;
    button.tabIndex = active ? 0 : -1;
    button.setAttribute("aria-label", resultAccessibleLabel(record, archived));
    button.setAttribute("aria-current", active ? "true" : "false");
    button.innerHTML = `
      <h3>
        <span class="result-title">${escapeHtml(record.title)}</span>
        ${archived ? '<span class="result-status">Archived</span>' : ""}
      </h3>
      <p>${escapeHtml(record.solution || record.issues || record.moreInfo)}</p>
    `;
    button.addEventListener("click", () => {
      enterRecordWorkspace(record.id);
      render();
    });
    button.addEventListener("keydown", (event) => handleResultKeydown(event, record.id));
    fields.results.appendChild(button);
  });

  if (pendingResultFocusId) {
    const focusId = pendingResultFocusId;
    pendingResultFocusId = "";
    focusResultButton(focusId);
    requestAnimationFrame(() => focusResultButton(focusId));
  }
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
  fields.resultsPanel.classList.toggle("hidden", draftPanelOpen || recoveryPanelOpen);
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

function recoveryUpdatedText(item) {
  const record = item.record || {};
  if (item.recoveryType === "Deleted") {
    const deleted = formatMetaDate(record.deletedAt) || "Not listed";
    const editor = usefulMetaValue(record.deletedBy);
    return editor ? `Deleted ${deleted} by ${editor}` : `Deleted ${deleted}`;
  }

  const updated = formatMetaDate(record.updatedAt) || "Not listed";
  const editor = usefulMetaValue(record.updatedBy);
  return editor ? `Archived ${updated} by ${editor}` : `Archived ${updated}`;
}

function renderRecovery() {
  if (!fields.recoveryPanel || !fields.recoveryList) return;

  fields.recoveryPanel.classList.toggle("hidden", !recoveryPanelOpen);
  if (fields.toggleRecovery) {
    fields.toggleRecovery.textContent = recoveryPanelOpen ? "Records" : "Recovery";
  }
  if (!recoveryPanelOpen) return;

  const items = recoveryItems();
  if (!items.some((item) => recoveryKey(item) === selectedRecoveryKey)) {
    selectedRecoveryKey = items[0] ? recoveryKey(items[0]) : "";
  }

  fields.recoveryCount.textContent = `${items.length} ${items.length === 1 ? "record" : "records"}`;
  fields.recoveryList.innerHTML = "";

  if (!items.length) {
    fields.recoveryList.innerHTML = '<div class="draft-empty">No archived or deleted records.</div>';
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    const record = item.record || {};
    const active = recoveryKey(item) === selectedRecoveryKey;
    button.type = "button";
    button.className = `recovery-card ${item.recoveryType.toLowerCase()}${active ? " active" : ""}`;
    button.innerHTML = `
      <div class="recovery-card-head">
        <h3>${escapeHtml(record.title || "Untitled record")}</h3>
        <span class="recovery-pill">${escapeHtml(item.recoveryType)}</span>
      </div>
      <p>${escapeHtml(record.solution || record.issues || record.moreInfo || "No record details listed.")}</p>
      <div class="recovery-card-meta">
        <span>${escapeHtml(recoveryUpdatedText(item))}</span>
      </div>
      ${item.recoveryType === "Archived" && record.archiveReason ? `<p class="recovery-card-note">Reason: ${escapeHtml(record.archiveReason)}</p>` : ""}
    `;
    button.addEventListener("click", () => {
      enterRecoveryWorkspace(recoveryKey(item));
      render();
    });
    fields.recoveryList.appendChild(button);
  });
}

function renderArchiveReasonPanel(open) {
  if (!fields.archiveReasonPanel) return;
  fields.archiveReasonPanel.classList.toggle("hidden", !open);
  if (open && fields.archiveReasonInput && fields.archiveReasonInput.value !== archiveReasonText) {
    fields.archiveReasonInput.value = archiveReasonText;
  }
}

function renderAnswer(record) {
  const draft = editorMode === "draft" ? currentDraft() : null;
  const recoveryItem = editorMode === "recovery" ? currentRecoveryItem() : null;
  const archivedSearchRecord = Boolean(record && !draft && !recoveryItem && isArchivedRecord(record));
  const isPublishedDraft = normalize(draft?.status) === "published";
  const canPublishDraft = Boolean(draft && !draft.isUnsaved && !isPublishedDraft && dataMode === "google-sheet");
  const canManageRecord = Boolean(record && !draft && !recoveryItem && dataMode === "google-sheet" && !isArchivedRecord(record));
  const canRestoreRecord = Boolean(record && dataMode === "google-sheet" && (recoveryItem || archivedSearchRecord));
  const canDeleteArchivedRecord = Boolean(record && dataMode === "google-sheet" && recoveryItem?.recoveryType === "Archived");
  const archiveReasonOpen = Boolean(canManageRecord && archiveReasonRecordId === record?.id);

  fields.publishDraft.classList.toggle("hidden", !canPublishDraft);
  fields.deleteDraft.classList.toggle("hidden", !draft);
  fields.archiveRecord.classList.toggle("hidden", !canManageRecord || archiveReasonOpen);
  fields.deleteRecord.classList.toggle("hidden", !canDeleteArchivedRecord);
  fields.restoreRecord.classList.toggle("hidden", !canRestoreRecord);
  if (draft) {
    fields.publishDraft.textContent = isDraftActionArmed("publish", draft) ? "Confirm Publish" : "Publish Draft";
    fields.deleteDraft.textContent = isDraftActionArmed("delete", draft)
      ? "Confirm Delete"
      : (draft.isUnsaved ? "Discard Draft" : "Delete Draft");
  }
  if (canManageRecord) {
    fields.archiveRecord.textContent = "Archive Record";
  }
  if (canDeleteArchivedRecord) {
    fields.deleteRecord.textContent = isRecordActionArmed("delete", recoveryItem) ? "Confirm Delete" : "Delete Record";
    fields.deleteRecord.classList.toggle("armed", isRecordActionArmed("delete", recoveryItem));
  } else {
    fields.deleteRecord.classList.remove("armed");
  }
  if (canRestoreRecord) {
    fields.restoreRecord.textContent = isRecordActionArmed("restore", recoveryItem || record) ? "Confirm Restore" : "Restore Record";
  }
  fields.toggleEditor.textContent = draft ? "Edit Draft" : "Edit Record";
  fields.toggleEditor.classList.toggle("hidden", !record || Boolean(recoveryItem) || archivedSearchRecord);
  renderArchiveReasonPanel(archiveReasonOpen);

  if (!record) {
    cancelPendingRecordView();
    fields.title.textContent = "No record selected";
    fields.meta.textContent = draftPanelOpen
      ? "Select a draft or create a new one."
      : (recoveryPanelOpen ? "Select an archived or deleted record." : "Source pending");
    fields.reviewMeta.textContent = "Last updated pending";
    fields.answer.innerHTML = "";
    renderArchiveReasonPanel(false);
    return;
  }

  const recommendedMode = recommendedOutputMode(record);
  const displayMode = activeOutputMode(record);
  const outputNote = fields.outputMode.value === "auto"
    ? `Best fit: ${outputModeLabel(displayMode)}`
    : `Suggested: ${outputModeLabel(recommendedMode)}`;

  fields.title.textContent = record.title;
  fields.meta.textContent = recoveryItem
    ? `${recoveryItem.recoveryType} record | ${record.department || "General"} | ${record.system || "No escalation listed"} | ${outputNote}`
    : draft
    ? `${draft.status || "Draft"} | ${draftVersionLabel(draft)} | ${record.department || "General"} | ${outputNote}`
    : archivedSearchRecord
    ? `Archived record | ${record.department} | ${record.system || "No escalation listed"} | ${outputNote}`
    : `${record.department} | ${record.system || "No escalation listed"} | ${outputNote}`;
  fields.reviewMeta.textContent = recoveryItem?.recoveryType === "Deleted"
    ? `Deleted: ${formatMetaDate(record.deletedAt) || "Not listed"} | Deleted by: ${usefulMetaValue(record.deletedBy) || "Not listed"}`
    : recoveryItem?.recoveryType === "Archived"
    ? `Archived record | ${recordReviewText(record)}`
    : archivedSearchRecord
    ? `Archived record | ${recordReviewText(record)}`
    : draft
    ? `Last updated: ${formatMetaDate(draft.updatedAt) || "Not saved yet"} | Reviewed by: ${usefulMetaValue(draft.updatedBy) || "Not listed"}`
    : recordReviewText(record);
  const relatedKbs = displayRelatedKbs(record);
  const usefulEscalation = usefulEscalationValue(record);
  const attachmentsHtml = record.attachments ? renderAttachments(record.attachments) : "";
  const archiveReasonHtml = isArchivedRecord(record) && record.archiveReason ? `
      <section class="answer-block">
        <h3>Archive Reason</h3>
        <p class="prewrap">${renderLinkedText(record.archiveReason)}</p>
      </section>
      ` : "";

  if (displayMode === "solution") {
    fields.answer.innerHTML = `
      ${archiveReasonHtml}
      ${record.issues ? `
      <section class="answer-block">
        <h3>Main Issue</h3>
        <p class="prewrap">${renderLinkedText(record.issues)}</p>
      </section>
      ` : ""}
      ${record.solution || !draft ? `
      <section class="answer-block">
        <h3>Resolution</h3>
        <p class="prewrap">${renderLinkedText(record.solution || "No resolution listed.")}</p>
      </section>
      ` : ""}
      ${record.moreInfo ? `
      <section class="answer-block">
        <h3>More Information</h3>
        <p class="prewrap">${renderLinkedText(record.moreInfo)}</p>
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
        <p class="prewrap">${renderLinkedText(usefulEscalation || "No escalation listed.")}</p>
      </section>
      ` : ""}
      ${relatedKbs ? `
      <section class="answer-block">
        <h3>Related KBs</h3>
        <p class="prewrap">${renderLinkedText(relatedKbs)}</p>
      </section>
      ` : ""}
    `;
  }

  if (displayMode === "checklist") {
    fields.answer.innerHTML = `
      ${archiveReasonHtml}
      ${record.steps.length || !draft ? `
      <section class="answer-block">
        <h3>Checklist</h3>
        <div class="checklist">
          ${record.steps.map((step, index) => `
            <label class="checkline">
              <input type="checkbox">
              <span>${index + 1}. ${renderLinkedText(step)}</span>
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
      ${archiveReasonHtml}
      ${record.issues || record.solution || !draft ? `
      <section class="answer-block">
        <h3>Purpose</h3>
        <p class="prewrap">${renderLinkedText(record.issues || record.solution || record.title)}</p>
      </section>
      ` : ""}
      ${record.steps.length || !draft ? `
      <section class="answer-block">
        <h3>Procedure</h3>
        <ol class="steps">
          ${record.steps.map((step) => `<li>${renderLinkedText(step)}</li>`).join("")}
        </ol>
      </section>
      ` : ""}
      ${record.moreInfo || !draft ? `
      <section class="answer-block">
        <h3>Reference Notes</h3>
        <p class="prewrap">${renderLinkedText(record.moreInfo || "No additional notes listed.")}</p>
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
        <p class="prewrap">${renderLinkedText(usefulEscalation || "No escalation listed.")}</p>
      </section>
      ` : ""}
      ${relatedKbs || !draft ? `
      <section class="answer-block">
        <h3>Related KBs</h3>
        <p class="prewrap">${renderLinkedText(relatedKbs || "No related KBs listed.")}</p>
      </section>
      ` : ""}
    `;
  }

  queueRecordView(record);
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

function draftHasMeaningfulContent(record) {
  if (!record) return false;
  const title = normalize(record.title);
  return Boolean(
    (title && title !== "untitled draft") ||
    normalize(record.issues) ||
    normalize(record.solution) ||
    normalize(record.moreInfo) ||
    normalize(record.attachments) ||
    normalize(record.source || record.relatedKbs)
  );
}

function draftAutosaveSignature(draft, record) {
  return JSON.stringify({
    draftId: draft?.draftId || "",
    version: draft?.version || 0,
    recordId: draft?.recordId || record?.id || "",
    title: record?.title || "",
    department: record?.department || "",
    system: record?.system || record?.escalation || "",
    source: record?.source || record?.relatedKbs || "",
    issues: record?.issues || "",
    solution: record?.solution || "",
    moreInfo: record?.moreInfo || "",
    attachments: record?.attachments || ""
  });
}

async function autosaveCurrentDraft() {
  window.clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer = 0;

  const draft = currentDraft();
  const record = currentRecord();
  if (!draft || !record || editorMode !== "draft" || !editorOpen) return;

  applyEditorValues(record);
  if (!draftHasMeaningfulContent(record)) return;

  const signature = draftAutosaveSignature(draft, record);
  if (signature === lastDraftAutosaveSignature) return;

  if (draftAutosaveInFlight) {
    draftAutosaveQueued = true;
    return;
  }

  draftAutosaveInFlight = true;
  const selectedKeyAtStart = selectedDraftKey;
  setDataStatus("Autosaving draft", "warning");

  try {
    let savedDraft;
    if (dataMode === "google-sheet") {
      savedDraft = await autosaveDraftToBackend({
        ...draft,
        recordId: draft.recordId || record.id,
        record
      });
      rememberSavedDraft(savedDraft, selectedDraftKey === selectedKeyAtStart);
      setDataStatus("Draft autosaved", "ok");
    } else {
      savedDraft = {
        ...draft,
        version: draft.isUnsaved ? 1 : Number(draft.version || 1),
        status: "Local Draft",
        updatedAt: new Date().toISOString(),
        isUnsaved: false,
        record: structuredClone(record)
      };
      rememberSavedDraft(savedDraft, selectedDraftKey === selectedKeyAtStart);
      setDataStatus("Draft autosaved locally", "warning");
    }

    lastDraftAutosaveSignature = draftAutosaveSignature(savedDraft, savedDraft.record);
    writeBackendCache();
    renderDrafts();
    if (selectedDraftKey === draftKey(savedDraft)) {
      renderAnswer(currentRecord());
    }
  } catch (error) {
    console.error(error);
    setDataStatus("Draft autosave failed", "error");
  } finally {
    draftAutosaveInFlight = false;
    if (draftAutosaveQueued) {
      draftAutosaveQueued = false;
      scheduleDraftAutosave();
    }
  }
}

function scheduleDraftAutosave() {
  if (editorMode !== "draft" || !editorOpen) return;
  window.clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer = window.setTimeout(() => autosaveCurrentDraft(), DRAFT_AUTOSAVE_DELAY);
}

function render() {
  const visibleRecords = searchableRecords();
  fillSelect(fields.department, visibleRecords.map((record) => record.department));
  fillSelect(fields.system, visibleRecords.map((record) => record.system));
  const matches = filteredRecords();
  renderResults(matches);
  renderDrafts();
  renderRecovery();
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
      archiveReason: firstValue(rowObject, ["archivereason"]) || "",
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
  const headers = ["id", "title", "department", "system", "severity", "keywords", "issues", "solution", "steps", "moreInfo", "attachments", "relatedKbs", "escalation", "owner", "reviewed", "updatedAt", "updatedBy", "reviewedBy", "archiveReason", "source"];
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
    const cachedData = readBackendCache();
    let cacheApplied = false;

    if (cachedData) {
      applyBackendCache(cachedData);
      cacheApplied = true;
    } else {
      setDataStatus("Refreshing records", "warning");
      renderLoadingState();
    }

    try {
      const latestRecords = await loadBackendRecords();
      dataMode = "google-sheet";

      if (!latestRecords.length && cacheApplied) {
        setDataStatus("Ready - keeping saved records", "warning");
        return;
      }

      records = latestRecords;
      selectedId = activeRecords().some((record) => record.id === selectedId)
        ? selectedId
        : (activeRecords()[0]?.id || "");
      render();
      if (records.length) {
        writeBackendCache();
        setDataStatus("Ready", "ok");
      } else {
        setDataStatus("No records found", "warning");
      }
      return;
    } catch (error) {
      console.error(error);
      if (cacheApplied) {
        setDataStatus("Ready - refresh failed", "warning");
        return;
      }
      setDataStatus("Preview only", "error");
    }
  } else {
    setDataStatus("Setup needed", "error");
  }

  try {
    const response = await fetch("knowledge.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("CSV not available");
    records = parseCsv(await response.text());
  } catch {
    records = structuredClone(fallbackRecords);
  }
  dataMode = "local-preview";
  drafts = [];
  selectedId = activeRecords()[0]?.id || "";
  render();
}

function resetSelectionAndRender() {
  selectedId = "";
  selectedDraftKey = "";
  selectedRecoveryKey = "";
  draftPanelOpen = false;
  recoveryPanelOpen = false;
  editorMode = "record";
  editorOpen = false;
  pendingDraftAction = "";
  pendingDraftActionExpires = 0;
  clearPendingRecordAction();
  clearDraftAutosave();
  lastDraftAutosaveSignature = "";
  clearArchiveReason();
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

fields.toggleRecovery.addEventListener("click", () => {
  if (recoveryPanelOpen) {
    enterRecordWorkspace();
  } else {
    enterRecoveryWorkspace();
  }
  render();
});

fields.toggleEditor.addEventListener("click", async () => {
  if (editorOpen && editorMode === "draft") {
    await autosaveCurrentDraft();
  }
  editorOpen = !editorOpen;
  clearArchiveReason();
  render();
});

document.querySelector("#closeEditor").addEventListener("click", async () => {
  if (editorMode === "draft") {
    await autosaveCurrentDraft();
  }
  editorOpen = false;
  render();
});

fields.editor.addEventListener("input", scheduleDraftAutosave);
fields.editor.addEventListener("change", scheduleDraftAutosave);

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

  clearDraftAutosave();
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
        setDataStatus("Draft version saved", "ok");
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
      setDataStatus("Saved", "ok");
    } else {
      setDataStatus("Draft saved locally", "warning");
    }
    editorOpen = false;
    writeBackendCache();
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
    writeBackendCache();
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
  clearDraftAutosave();
  const title = draft.record?.title || "Untitled draft";
  const confirmed = await openConfirmDialog({
    title: draft.isUnsaved ? "Discard this draft?" : "Delete this draft?",
    body: draft.isUnsaved
      ? `Draft: ${title}. This will be removed from this session.`
      : `Draft: ${title}. This and its saved draft versions will be removed from Drafts. Published records are not affected.`,
    confirmText: draft.isUnsaved ? "Discard Draft" : "Delete Draft"
  });
  if (!confirmed) return;

  try {
    if (draft.isUnsaved || dataMode !== "google-sheet") {
      drafts = drafts.filter((item) => item.draftId !== draft.draftId);
      setDataStatus("Draft discarded", "warning");
    } else {
      setDataStatus("Deleting draft...", "warning");
      await deleteDraftFromBackend(draft.draftId);
      drafts = drafts.filter((item) => item.draftId !== draft.draftId);
      setDataStatus("Draft deleted", "ok");
    }

    selectedDraftKey = drafts[0] ? draftKey(drafts[0]) : "";
    editorMode = "draft";
    selectedId = "";
    editorOpen = false;
    writeBackendCache();
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Delete failed", "error");
    alert(`Unable to delete this draft: ${error.message}`);
  }
});

fields.archiveRecord.addEventListener("click", () => {
  const record = currentRecord();
  if (!record || isArchivedRecord(record)) return;
  openArchiveReason(record);
});

fields.archiveReasonInput?.addEventListener("input", () => {
  archiveReasonText = fields.archiveReasonInput.value;
  fields.archiveReasonInput.setCustomValidity("");
});

fields.cancelArchiveReason?.addEventListener("click", () => {
  clearArchiveReason();
  setDataStatus("Archive canceled", "warning");
  render();
});

fields.archiveReasonPanel?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = records.find((item) => item.id === archiveReasonRecordId);
  const reason = archiveReasonText.trim();
  if (!record || isArchivedRecord(record)) {
    clearArchiveReason();
    render();
    return;
  }
  if (!reason) {
    fields.archiveReasonInput.setCustomValidity("Archive reason is required.");
    fields.archiveReasonInput.reportValidity();
    setDataStatus("Archive reason required", "warning");
    return;
  }

  const confirmed = await openConfirmDialog({
    title: "Archive this record?",
    body: `Record: ${record.title}. This will move out of active records and into Recovery with the archive reason you entered.`,
    confirmText: "Archive Record",
    danger: false
  });
  if (!confirmed) return;

  const submitButton = fields.archiveReasonPanel.querySelector("button[type='submit']");
  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Archiving...";
    }
    setDataStatus("Archiving record...", "warning");
    const archivedRecord = await archiveRecordInBackend(record.id, reason);
    const index = records.findIndex((item) => item.id === archivedRecord.id);
    if (index >= 0) records[index] = archivedRecord;
    selectedId = activeRecords()[0]?.id || "";
    editorOpen = false;
    clearArchiveReason();
    setDataStatus("Record archived", "ok");
    writeBackendCache();
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Archive failed", "error");
    alert(`Unable to archive this record: ${error.message}`);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Confirm Archive";
    }
  }
});

fields.deleteRecord.addEventListener("click", async () => {
  const recoveryItem = currentRecoveryItem();
  const record = recoveryItem?.record || null;
  if (!record || recoveryItem?.recoveryType !== "Archived") return;
  const confirmed = await openConfirmDialog({
    title: "Delete this archived record?",
    body: `Record: ${record.title}. This will move from Archived to Deleted Records. Use this only when it is no longer needed.`,
    confirmText: "Delete Record"
  });
  if (!confirmed) return;

  try {
    setDataStatus("Deleting record...", "warning");
    const deletedRecord = await deleteRecordInBackend(record.id);
    deletedRecords = [
      deletedRecord,
      ...deletedRecords.filter((item) => item.id !== deletedRecord.id)
    ];
    records = records.filter((item) => item.id !== record.id);
    editorOpen = false;
    enterRecoveryWorkspace(recoveryRecordKey("Deleted", deletedRecord.id));
    setDataStatus("Record moved to Deleted Records", "ok");
    writeBackendCache();
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Delete failed", "error");
    alert(`Unable to delete this record: ${error.message}`);
  }
});

fields.restoreRecord.addEventListener("click", async () => {
  const recoveryItem = currentRecoveryItem();
  const record = recoveryItem?.record || currentRecord();
  const restoringArchivedSearchRecord = Boolean(!recoveryItem && record && isArchivedRecord(record));
  if (!record || (!recoveryItem && !restoringArchivedSearchRecord)) return;
  const confirmationTarget = recoveryItem || record;
  if (!requireRecordActionConfirmation("restore", confirmationTarget)) return;

  try {
    setDataStatus("Restoring record...", "warning");
    const restoredRecord = recoveryItem?.recoveryType === "Deleted"
      ? await restoreDeletedRecordInBackend(record.id)
      : await restoreArchivedRecordInBackend(record.id);

    const index = records.findIndex((item) => item.id === restoredRecord.id);
    if (index >= 0) {
      records[index] = restoredRecord;
    } else {
      records = [restoredRecord, ...records];
    }
    deletedRecords = deletedRecords.filter((item) => item.id !== restoredRecord.id);
    enterRecordWorkspace(restoredRecord.id);
    setDataStatus("Record restored", "ok");
    writeBackendCache();
    render();
  } catch (error) {
    console.error(error);
    setDataStatus("Restore failed", "error");
    alert(`Unable to restore this record: ${error.message}`);
  }
});

fields.cancelConfirmDialog?.addEventListener("click", () => closeConfirmDialog(false));
fields.confirmDialogAction?.addEventListener("click", () => closeConfirmDialog(true));
fields.confirmDialog?.addEventListener("click", (event) => {
  if (event.target === fields.confirmDialog || event.target === fields.confirmDialog.querySelector(".confirm-dialog-backdrop")) {
    closeConfirmDialog(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (!activeConfirmDialog) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeConfirmDialog(false);
    return;
  }

  if (event.key !== "Tab") return;
  const targets = confirmFocusTargets();
  if (!targets.length) return;

  const first = targets[0];
  const last = targets[targets.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

loadInitialData();
