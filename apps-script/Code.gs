const KNOWLEDGE_SHEET = "Knowledge";
const AUDIT_SHEET = "Audit Log";
const SYNONYM_SHEET = "Search Synonyms";
const DRAFT_SHEET = "Drafts";
const DELETED_SHEET = "Deleted Records";
const RECORD_VIEWS_SHEET = "Record Views";
const MAX_EMBEDDED_IMAGE_BYTES = 1500000;

const KNOWLEDGE_HEADERS = [
  "ID",
  "Topic",
  "University Service",
  "Main Issues",
  "Resolution",
  "More Information",
  "Attachments / Images",
  "Related KBs",
  "Keywords",
  "Escalation",
  "Status",
  "Archive Reason",
  "Updated At",
  "Updated By"
];

const AUDIT_HEADERS = [
  "Audit ID",
  "Timestamp",
  "Editor",
  "Action",
  "Record ID",
  "Topic",
  "Changed Fields",
  "Before JSON",
  "After JSON",
  "Note"
];

const SYNONYM_HEADERS = [
  "Term",
  "Synonyms",
  "Notes"
];

const DRAFT_HEADERS = [
  "Draft ID",
  "Record ID",
  "Version",
  "Topic",
  "University Service",
  "Main Issues",
  "Resolution",
  "More Information",
  "Attachments / Images",
  "Related KBs",
  "Keywords",
  "Escalation",
  "Status",
  "Created At",
  "Created By",
  "Updated At",
  "Updated By",
  "Published At",
  "Published Record ID"
];

const DELETED_HEADERS = KNOWLEDGE_HEADERS.concat([
  "Deleted At",
  "Deleted By"
]);

const RECORD_VIEW_HEADERS = [
  "View ID",
  "Timestamp",
  "Viewer",
  "Record ID",
  "Topic",
  "Status",
  "Source",
  "Page URL",
  "User Agent"
];

const DEFAULT_SYNONYM_ROWS = [
  ["zoom", "nyu zoom|zoom cloud|cloud recording|cloud recordings|meeting recording|meeting recordings|recorded meeting", "Meeting recording searches should find Zoom recording records."],
  ["adobe", "adobe creative cloud|creative cloud|acrobat|adobe acrobat|pdf|license|licensed", "Adobe, Acrobat, PDF, and license searches are related."],
  ["g drive", "g: drive|google drive|drive missing|shared drive|network drive|mapped drive", "Common wording for mapped/network drive issues."],
  ["wifi", "wi fi|wireless|nyu wifi|nyu wireless|eduroam", ""],
  ["vpn", "globalprotect|global protect|remote access|cisco|cisco secure client|anyconnect", ""],
  ["email", "e mail|gmail|stern gmail|nyu email|mail", ""],
  ["password", "login|log in|sign in|netid|nyu account|credentials|sso", ""],
  ["duo", "mfa|2fa|two factor|multi factor|authentication", ""],
  ["printer", "printing|print|papercut", ""],
  ["campusgroups", "campus groups|student group|club|group access", ""],
  ["12twenty", "career account|career center|ccwp", ""],
  ["nyu classes", "classes|brightspace", ""],
  ["sharepoint", "one drive|onedrive", ""],
  ["tableau", "analytics|dashboard", ""],
  ["qualtrics", "survey|surveys", ""]
];

function doGet() {
  return jsonResponse({
    ok: true,
    service: "Stern IT Service Desk API",
    records: listRecords_(),
    drafts: listDrafts_(),
    deletedRecords: listDeletedRecords_(),
    searchSynonyms: listSearchSynonyms_()
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    const action = payload.action || "listRecords";

    if (action === "listRecords") {
      return jsonResponse({ ok: true, records: listRecords_(), drafts: listDrafts_(), deletedRecords: listDeletedRecords_(), searchSynonyms: listSearchSynonyms_() });
    }

    if (action === "listDrafts") {
      return jsonResponse({ ok: true, drafts: listDrafts_() });
    }

    if (action === "listDeletedRecords") {
      return jsonResponse({ ok: true, deletedRecords: listDeletedRecords_() });
    }

    if (action === "listSearchSynonyms") {
      return jsonResponse({ ok: true, searchSynonyms: listSearchSynonyms_() });
    }

    if (action === "saveRecord") {
      return jsonResponse({ ok: true, record: saveRecord_(payload.record || {}) });
    }

    if (action === "archiveRecord") {
      return jsonResponse({ ok: true, record: archiveRecord_(payload.recordId || payload.id || "", payload.archiveReason || payload.reason || "") });
    }

    if (action === "deleteRecord") {
      return jsonResponse({ ok: true, deleted: deleteRecord_(payload.recordId || payload.id || "") });
    }

    if (action === "restoreArchivedRecord") {
      return jsonResponse({ ok: true, record: restoreArchivedRecord_(payload.recordId || payload.id || "") });
    }

    if (action === "restoreDeletedRecord") {
      return jsonResponse({ ok: true, record: restoreDeletedRecord_(payload.recordId || payload.id || "") });
    }

    if (action === "trackRecordView") {
      return jsonResponse({ ok: true, view: trackRecordView_(payload.view || {}) });
    }

    if (action === "replaceAllRecords") {
      return jsonResponse({ ok: true, records: replaceAllRecords_(payload.records || []) });
    }

    if (action === "saveDraft") {
      return jsonResponse({ ok: true, draft: saveDraft_(payload.draft || {}) });
    }

    if (action === "autosaveDraft") {
      return jsonResponse({ ok: true, draft: saveDraft_(payload.draft || {}, { autosave: true }) });
    }

    if (action === "deleteDraft") {
      return jsonResponse({ ok: true, deleted: deleteDraft_(payload.draftId || "") });
    }

    if (action === "publishDraft") {
      return jsonResponse({ ok: true, record: publishDraft_(payload.draftId || "", payload.version || "") });
    }

    if (action === "health") {
      return jsonResponse({
        ok: true,
        editor: getEditorEmail_(),
        spreadsheet: SpreadsheetApp.getActive().getName(),
        searchSynonyms: listSearchSynonyms_().length
      });
    }

    return jsonResponse({ ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function setupSheets() {
  const knowledge = getOrCreateSheet_(KNOWLEDGE_SHEET);
  const audit = getOrCreateSheet_(AUDIT_SHEET);
  const synonyms = getOrCreateSheet_(SYNONYM_SHEET);
  const drafts = getOrCreateSheet_(DRAFT_SHEET);
  const deleted = getOrCreateSheet_(DELETED_SHEET);
  const recordViews = getOrCreateSheet_(RECORD_VIEWS_SHEET);
  ensureHeaders_(knowledge, KNOWLEDGE_HEADERS);
  ensureHeaders_(audit, AUDIT_HEADERS);
  ensureHeaders_(synonyms, SYNONYM_HEADERS);
  ensureHeaders_(drafts, DRAFT_HEADERS);
  ensureHeaders_(deleted, DELETED_HEADERS);
  ensureHeaders_(recordViews, RECORD_VIEW_HEADERS);
  seedDefaultSynonyms_(synonyms);
  ensureRecordIds_(knowledge);
}

function listRecords_() {
  const sheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
  ensureHeaders_(sheet, KNOWLEDGE_HEADERS);
  ensureRecordIds_(sheet);

  const range = sheet.getDataRange();
  const values = range.getValues();
  const richTextValues = range.getRichTextValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  const attachmentColumn = headers.indexOf("Attachments / Images");
  const chipAttachmentValues = attachmentColumn >= 0 ? attachmentChipValues_(sheet, headers, values.length) : [];
  const driveAttachmentCache = {};
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row, index) => {
      const nextRow = row.slice();
      if (attachmentColumn >= 0) {
        nextRow[attachmentColumn] = attachmentCellValue_(
          row[attachmentColumn],
          richTextValues[index + 1][attachmentColumn],
          chipAttachmentValues[index],
          driveAttachmentCache
        );
      }
      return rowToRecord_(headers, nextRow);
    });
}

function listDeletedRecords_() {
  const sheet = getOrCreateSheet_(DELETED_SHEET);
  ensureHeaders_(sheet, DELETED_HEADERS);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => {
      const record = rowToRecord_(headers, row);
      const data = {};
      headers.forEach((header, index) => {
        data[header] = value_(row[index]);
      });
      record.status = "Deleted";
      record.deletedAt = data["Deleted At"] || "";
      record.deletedBy = data["Deleted By"] || "";
      return record;
    })
    .sort((a, b) => String(b.deletedAt || b.updatedAt || "").localeCompare(String(a.deletedAt || a.updatedAt || "")));
}

function listSearchSynonyms_() {
  const sheet = getOrCreateSheet_(SYNONYM_SHEET);
  ensureHeaders_(sheet, SYNONYM_HEADERS);
  seedDefaultSynonyms_(sheet);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  const termColumn = headers.indexOf("Term");
  const synonymsColumn = headers.indexOf("Synonyms");

  return values
    .slice(1)
    .map((row) => {
      const term = value_(row[termColumn]);
      const synonyms = synonymsColumn >= 0 ? splitSynonyms_(row[synonymsColumn]) : [];
      return [term].concat(synonyms).filter(Boolean);
    })
    .filter((group) => group.length > 1);
}

function seedDefaultSynonyms_(sheet) {
  const headers = getHeaders_(sheet);
  const termColumn = headers.indexOf("Term") + 1;
  if (!termColumn) return;

  const lastRow = sheet.getLastRow();
  const existingTerms = lastRow > 1
    ? sheet.getRange(2, termColumn, lastRow - 1, 1).getValues().flat().map((value) => value_(value).toLowerCase())
    : [];
  const existingSet = new Set(existingTerms.filter(Boolean));
  const rowsToAdd = DEFAULT_SYNONYM_ROWS.filter((row) => !existingSet.has(value_(row[0]).toLowerCase()));

  if (rowsToAdd.length) {
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, SYNONYM_HEADERS.length).setValues(rowsToAdd);
  }
}

function saveRecord_(incomingRecord) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    ensureHeaders_(sheet, KNOWLEDGE_HEADERS);
    ensureRecordIds_(sheet);

    const headers = getHeaders_(sheet);
    const record = normalizeIncomingRecord_(incomingRecord);
    const rowNumber = findRowById_(sheet, headers, record.id);
    const existingRow = rowNumber ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0] : null;
    const before = existingRow ? rowToRecord_(headers, existingRow) : null;

    record.updatedAt = new Date().toISOString();
    record.updatedBy = getEditorEmail_();

    const nextRow = recordToRow_(headers, record, existingRow);
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, nextRow.length).setValues([nextRow]);
    } else {
      sheet.appendRow(nextRow);
    }

    const after = rowToRecord_(headers, nextRow);
    appendAudit_(before ? "update" : "create", before, after, "");
    return after;
  } finally {
    lock.releaseLock();
  }
}

function archiveRecord_(recordId, archiveReason) {
  const reason = value_(archiveReason);
  if (!reason) throw new Error("Archive reason is required.");
  return updateRecordStatus_(
    recordId,
    "Archived",
    "archive",
    `Archived record from website. Reason: ${reason}`,
    { archiveReason: reason }
  );
}

function restoreArchivedRecord_(recordId) {
  return updateRecordStatus_(recordId, "Active", "restore_archive", "Restored archived record to active records.", { archiveReason: "" });
}

function updateRecordStatus_(recordId, status, auditAction, note, updates) {
  const id = value_(recordId);
  if (!id) throw new Error("Record ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    ensureHeaders_(sheet, KNOWLEDGE_HEADERS);
    ensureRecordIds_(sheet);

    const headers = getHeaders_(sheet);
    const rowNumber = findRowById_(sheet, headers, id);
    if (!rowNumber) throw new Error("Record not found.");

    const existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    const before = rowToRecord_(headers, existingRow);
    const record = Object.assign({}, before, {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: getEditorEmail_()
    }, updates || {});
    const nextRow = recordToRow_(headers, record, existingRow);
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([nextRow]);

    const after = rowToRecord_(headers, nextRow);
    appendAudit_(auditAction, before, after, note || "");
    return after;
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(recordId) {
  const id = value_(recordId);
  if (!id) throw new Error("Record ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    const deletedSheet = getOrCreateSheet_(DELETED_SHEET);
    ensureHeaders_(sheet, KNOWLEDGE_HEADERS);
    ensureHeaders_(deletedSheet, DELETED_HEADERS);
    ensureRecordIds_(sheet);

    const headers = getHeaders_(sheet);
    const deletedHeaders = getHeaders_(deletedSheet);
    const rowNumber = findRowById_(sheet, headers, id);
    if (!rowNumber) throw new Error("Record not found.");

    const existingRow = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
    const before = rowToRecord_(headers, existingRow);
    const now = new Date().toISOString();
    const editor = getEditorEmail_();
    const deletedRecord = Object.assign({}, before, {
      status: "Deleted",
      updatedAt: now,
      updatedBy: editor,
      deletedAt: now,
      deletedBy: editor
    });
    removeRowsById_(deletedSheet, deletedHeaders, id);
    const deletedRow = recordToRow_(deletedHeaders, deletedRecord, null);
    setCell_(deletedHeaders, deletedRow, "Deleted At", now);
    setCell_(deletedHeaders, deletedRow, "Deleted By", editor);
    deletedSheet.appendRow(deletedRow);
    sheet.deleteRow(rowNumber);
    appendAudit_("delete", before, deletedRecord, "Moved record from Knowledge to Deleted Records.");
    return deletedRecord;
  } finally {
    lock.releaseLock();
  }
}

function restoreDeletedRecord_(recordId) {
  const id = value_(recordId);
  if (!id) throw new Error("Record ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const deletedSheet = getOrCreateSheet_(DELETED_SHEET);
    const knowledgeSheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    ensureHeaders_(deletedSheet, DELETED_HEADERS);
    ensureHeaders_(knowledgeSheet, KNOWLEDGE_HEADERS);
    ensureRecordIds_(knowledgeSheet);

    const deletedHeaders = getHeaders_(deletedSheet);
    const knowledgeHeaders = getHeaders_(knowledgeSheet);
    const deletedRowNumber = findRowById_(deletedSheet, deletedHeaders, id);
    if (!deletedRowNumber) throw new Error("Deleted record not found.");

    const deletedRow = deletedSheet.getRange(deletedRowNumber, 1, 1, deletedHeaders.length).getValues()[0];
    const before = rowToRecord_(deletedHeaders, deletedRow);
    const restoredRecord = Object.assign({}, before, {
      status: "Active",
      updatedAt: new Date().toISOString(),
      updatedBy: getEditorEmail_()
    });
    delete restoredRecord.deletedAt;
    delete restoredRecord.deletedBy;

    const existingRowNumber = findRowById_(knowledgeSheet, knowledgeHeaders, id);
    const existingRow = existingRowNumber ? knowledgeSheet.getRange(existingRowNumber, 1, 1, knowledgeHeaders.length).getValues()[0] : null;
    const nextRow = recordToRow_(knowledgeHeaders, restoredRecord, existingRow);
    if (existingRowNumber) {
      knowledgeSheet.getRange(existingRowNumber, 1, 1, knowledgeHeaders.length).setValues([nextRow]);
    } else {
      knowledgeSheet.appendRow(nextRow);
    }
    deletedSheet.deleteRow(deletedRowNumber);

    const after = rowToRecord_(knowledgeHeaders, nextRow);
    appendAudit_("restore_deleted", before, after, "Restored deleted record to Knowledge.");
    return after;
  } finally {
    lock.releaseLock();
  }
}

function trackRecordView_(incomingView) {
  const recordId = value_(incomingView.recordId || incomingView.id);
  if (!recordId) throw new Error("Record ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(RECORD_VIEWS_SHEET);
    ensureHeaders_(sheet, RECORD_VIEW_HEADERS);
    const headers = getHeaders_(sheet);
    const row = new Array(headers.length).fill("");

    setCell_(headers, row, "View ID", Utilities.getUuid());
    setCell_(headers, row, "Timestamp", new Date().toISOString());
    setCell_(headers, row, "Viewer", getViewerEmail_());
    setCell_(headers, row, "Record ID", recordId);
    setCell_(headers, row, "Topic", incomingView.title);
    setCell_(headers, row, "Status", incomingView.status || "Active");
    setCell_(headers, row, "Source", incomingView.source || "record");
    setCell_(headers, row, "Page URL", incomingView.pageUrl);
    setCell_(headers, row, "User Agent", incomingView.userAgent);

    sheet.appendRow(row);
    return {
      recordId,
      timestamp: row[headers.indexOf("Timestamp")]
    };
  } finally {
    lock.releaseLock();
  }
}

function replaceAllRecords_(incomingRecords) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    ensureHeaders_(sheet, KNOWLEDGE_HEADERS);
    const headers = getHeaders_(sheet);
    const beforeCount = Math.max(sheet.getLastRow() - 1, 0);

    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    const editor = getEditorEmail_();
    const now = new Date().toISOString();
    const records = incomingRecords.map((record) => {
      const normalized = normalizeIncomingRecord_(record);
      normalized.updatedAt = now;
      normalized.updatedBy = editor;
      return normalized;
    });

    if (records.length) {
      const rows = records.map((record) => recordToRow_(headers, record, null));
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    appendAudit_("bulk_replace", null, null, `Replaced ${beforeCount} records with ${records.length} records.`);
    return listRecords_();
  } finally {
    lock.releaseLock();
  }
}

function listDrafts_() {
  const sheet = getOrCreateSheet_(DRAFT_SHEET);
  ensureHeaders_(sheet, DRAFT_HEADERS);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => rowToDraft_(headers, row))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function saveDraft_(incomingDraft, options) {
  const autosave = Boolean(options && options.autosave);
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(DRAFT_SHEET);
    ensureHeaders_(sheet, DRAFT_HEADERS);
    const headers = getHeaders_(sheet);
    const rows = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues()
      : [];
    const draftId = value_(incomingDraft.draftId) || Utilities.getUuid();
    const existingDrafts = rows
      .map((row, index) => ({ rowNumber: index + 2, draft: rowToDraft_(headers, row), row }))
      .filter((item) => item.draft.draftId === draftId);
    const latestItem = existingDrafts
      .slice()
      .sort((a, b) => Number(b.draft.version || 0) - Number(a.draft.version || 0))[0] || null;
    const latestDraft = latestItem ? latestItem.draft : null;
    const incomingVersion = Number(incomingDraft.version || 0);
    const autosaveItem = autosave && incomingVersion
      ? existingDrafts.find((item) => Number(item.draft.version || 0) === incomingVersion) || null
      : null;
    const baseDraft = autosaveItem ? autosaveItem.draft : latestDraft;
    const record = normalizeIncomingRecord_(incomingDraft.record || incomingDraft);
    const now = new Date().toISOString();
    const editor = getEditorEmail_();
    const draft = {
      draftId,
      recordId: value_(incomingDraft.recordId || record.id),
      version: autosaveItem ? Number(autosaveItem.draft.version || 1) : (latestDraft ? Number(latestDraft.version || 0) + 1 : 1),
      status: "Draft",
      createdAt: baseDraft ? baseDraft.createdAt : now,
      createdBy: baseDraft ? baseDraft.createdBy : editor,
      updatedAt: now,
      updatedBy: editor,
      publishedAt: "",
      publishedRecordId: "",
      record
    };

    const nextRow = draftToRow_(headers, draft);
    if (autosaveItem) {
      sheet.getRange(autosaveItem.rowNumber, 1, 1, headers.length).setValues([nextRow]);
    } else {
      sheet.appendRow(nextRow);
    }
    const savedDraft = rowToDraft_(headers, nextRow);
    if (!autosave) {
      appendAudit_("draft_save", null, savedDraft.record, `Saved draft ${draftId} version ${draft.version}.`);
    }
    return savedDraft;
  } finally {
    lock.releaseLock();
  }
}

function deleteDraft_(draftId) {
  const id = value_(draftId);
  if (!id) throw new Error("Draft ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const sheet = getOrCreateSheet_(DRAFT_SHEET);
    ensureHeaders_(sheet, DRAFT_HEADERS);
    const headers = getHeaders_(sheet);
    const draftColumn = headers.indexOf("Draft ID") + 1;
    if (!draftColumn || sheet.getLastRow() <= 1) return 0;

    const ids = sheet.getRange(2, draftColumn, sheet.getLastRow() - 1, 1).getValues();
    let deleted = 0;
    for (let index = ids.length - 1; index >= 0; index -= 1) {
      if (value_(ids[index][0]) === id) {
        sheet.deleteRow(index + 2);
        deleted += 1;
      }
    }

    appendAudit_("draft_delete", null, { id, title: "" }, `Deleted ${deleted} draft version(s).`);
    return deleted;
  } finally {
    lock.releaseLock();
  }
}

function publishDraft_(draftId, version) {
  const id = value_(draftId);
  if (!id) throw new Error("Draft ID is required.");

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const draftSheet = getOrCreateSheet_(DRAFT_SHEET);
    ensureHeaders_(draftSheet, DRAFT_HEADERS);
    const draftHeaders = getHeaders_(draftSheet);
    const draftRows = draftSheet.getLastRow() > 1
      ? draftSheet.getRange(2, 1, draftSheet.getLastRow() - 1, draftHeaders.length).getValues()
      : [];
    const candidates = draftRows
      .map((row, index) => ({ rowNumber: index + 2, draft: rowToDraft_(draftHeaders, row), row }))
      .filter((item) => item.draft.draftId === id);
    const selected = selectDraftVersion_(candidates, version);
    if (!selected) throw new Error("Draft not found.");

    const knowledgeSheet = getOrCreateSheet_(KNOWLEDGE_SHEET);
    ensureHeaders_(knowledgeSheet, KNOWLEDGE_HEADERS);
    ensureRecordIds_(knowledgeSheet);
    const recordHeaders = getHeaders_(knowledgeSheet);
    const record = normalizeIncomingRecord_(selected.draft.record);
    record.id = selected.draft.recordId || record.id || Utilities.getUuid();
    record.updatedAt = new Date().toISOString();
    record.updatedBy = getEditorEmail_();

    const rowNumber = findRowById_(knowledgeSheet, recordHeaders, record.id);
    const existingRow = rowNumber ? knowledgeSheet.getRange(rowNumber, 1, 1, recordHeaders.length).getValues()[0] : null;
    const before = existingRow ? rowToRecord_(recordHeaders, existingRow) : null;
    const nextRow = recordToRow_(recordHeaders, record, existingRow);

    if (rowNumber) {
      knowledgeSheet.getRange(rowNumber, 1, 1, nextRow.length).setValues([nextRow]);
    } else {
      knowledgeSheet.appendRow(nextRow);
    }

    const publishedRecord = rowToRecord_(recordHeaders, nextRow);
    const draftRow = selected.row.slice();
    setCell_(draftHeaders, draftRow, "Status", "Published");
    setCell_(draftHeaders, draftRow, "Published At", record.updatedAt);
    setCell_(draftHeaders, draftRow, "Published Record ID", publishedRecord.id);
    draftSheet.getRange(selected.rowNumber, 1, 1, draftHeaders.length).setValues([draftRow]);

    appendAudit_("draft_publish", before, publishedRecord, `Published draft ${id} version ${selected.draft.version}.`);
    return publishedRecord;
  } finally {
    lock.releaseLock();
  }
}

function normalizeIncomingRecord_(record) {
  const escalation = value_(record.escalation || record.system || "No escalation listed");
  return {
    id: value_(record.id) || Utilities.getUuid(),
    title: value_(record.title) || "Untitled record",
    department: value_(record.department) || "General",
    issues: value_(record.issues),
    solution: value_(record.solution),
    moreInfo: value_(record.moreInfo),
    attachments: value_(record.attachments),
    relatedKbs: value_(record.relatedKbs || record.source),
    keywords: value_(record.keywords),
    escalation,
    status: value_(record.status) || "Active",
    archiveReason: value_(record.archiveReason),
    updatedAt: value_(record.updatedAt),
    updatedBy: value_(record.updatedBy)
  };
}

function rowToRecord_(headers, row) {
  const data = {};
  headers.forEach((header, index) => {
    data[header] = value_(row[index]);
  });

  const escalation = data["Escalation"] || "No escalation listed";
  const service = data["University Service"] || "General";
  const relatedKbs = data["Related KBs"] || "";
  const resolution = data["Resolution"] || data["Main Issues"] || data["More Information"] || "";

  return {
    id: data["ID"],
    title: data["Topic"] || "Untitled record",
    department: service,
    system: escalation,
    severity: escalation === "No escalation listed" ? "Low" : "Medium",
    keywords: data["Keywords"] || "",
    issues: data["Main Issues"] || "",
    solution: resolution,
    steps: splitSteps_(resolution),
    escalation,
    owner: service,
    reviewed: data["Updated At"] || "Google Sheet",
    source: relatedKbs || "Google Sheet",
    moreInfo: data["More Information"] || "",
    attachments: data["Attachments / Images"] || "",
    relatedKbs,
    status: data["Status"] || "Active",
    archiveReason: data["Archive Reason"] || "",
    updatedAt: data["Updated At"] || "",
    updatedBy: data["Updated By"] || ""
  };
}

function recordToRow_(headers, record, existingRow) {
  const row = existingRow ? existingRow.slice(0, headers.length) : new Array(headers.length).fill("");
  setCell_(headers, row, "ID", record.id);
  setCell_(headers, row, "Topic", record.title);
  setCell_(headers, row, "University Service", record.department);
  setCell_(headers, row, "Main Issues", record.issues);
  setCell_(headers, row, "Resolution", record.solution);
  setCell_(headers, row, "More Information", record.moreInfo);
  setCell_(headers, row, "Attachments / Images", record.attachments);
  setCell_(headers, row, "Related KBs", record.relatedKbs);
  setCell_(headers, row, "Keywords", record.keywords);
  setCell_(headers, row, "Escalation", record.escalation);
  setCell_(headers, row, "Status", record.status);
  setCell_(headers, row, "Archive Reason", record.archiveReason);
  setCell_(headers, row, "Updated At", record.updatedAt);
  setCell_(headers, row, "Updated By", record.updatedBy);
  return row;
}

function rowToDraft_(headers, row) {
  const data = {};
  headers.forEach((header, index) => {
    data[header] = value_(row[index]);
  });

  const record = {
    id: data["Record ID"] || "",
    title: data["Topic"] || "Untitled draft",
    department: data["University Service"] || "General",
    system: data["Escalation"] || "No escalation listed",
    severity: data["Escalation"] ? "Medium" : "Low",
    keywords: data["Keywords"] || "",
    issues: data["Main Issues"] || "",
    solution: data["Resolution"] || "",
    steps: splitSteps_(data["Resolution"] || ""),
    escalation: data["Escalation"] || "No escalation listed",
    owner: data["University Service"] || "General",
    reviewed: data["Updated At"] || data["Created At"] || "Draft",
    source: data["Related KBs"] || "",
    moreInfo: data["More Information"] || "",
    attachments: data["Attachments / Images"] || "",
    relatedKbs: data["Related KBs"] || "",
    status: data["Status"] || "Draft",
    updatedAt: data["Updated At"] || "",
    updatedBy: data["Updated By"] || "",
    reviewedBy: data["Updated By"] || ""
  };

  return {
    draftId: data["Draft ID"],
    recordId: data["Record ID"],
    version: Number(data["Version"] || 1),
    status: data["Status"] || "Draft",
    createdAt: data["Created At"] || "",
    createdBy: data["Created By"] || "",
    updatedAt: data["Updated At"] || "",
    updatedBy: data["Updated By"] || "",
    publishedAt: data["Published At"] || "",
    publishedRecordId: data["Published Record ID"] || "",
    record
  };
}

function draftToRow_(headers, draft) {
  const row = new Array(headers.length).fill("");
  const record = draft.record || {};
  setCell_(headers, row, "Draft ID", draft.draftId);
  setCell_(headers, row, "Record ID", draft.recordId || record.id);
  setCell_(headers, row, "Version", draft.version);
  setCell_(headers, row, "Topic", record.title);
  setCell_(headers, row, "University Service", record.department);
  setCell_(headers, row, "Main Issues", record.issues);
  setCell_(headers, row, "Resolution", record.solution);
  setCell_(headers, row, "More Information", record.moreInfo);
  setCell_(headers, row, "Attachments / Images", record.attachments);
  setCell_(headers, row, "Related KBs", record.relatedKbs || record.source);
  setCell_(headers, row, "Keywords", record.keywords);
  setCell_(headers, row, "Escalation", record.escalation || record.system);
  setCell_(headers, row, "Status", draft.status || "Draft");
  setCell_(headers, row, "Created At", draft.createdAt);
  setCell_(headers, row, "Created By", draft.createdBy);
  setCell_(headers, row, "Updated At", draft.updatedAt);
  setCell_(headers, row, "Updated By", draft.updatedBy);
  setCell_(headers, row, "Published At", draft.publishedAt);
  setCell_(headers, row, "Published Record ID", draft.publishedRecordId);
  return row;
}

function latestDraftVersion_(drafts) {
  return drafts
    .slice()
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null;
}

function selectDraftVersion_(items, version) {
  const requestedVersion = Number(value_(version));
  if (requestedVersion) {
    return items.find((item) => Number(item.draft.version || 0) === requestedVersion) || null;
  }

  return items
    .slice()
    .sort((a, b) => Number(b.draft.version || 0) - Number(a.draft.version || 0))[0] || null;
}

function appendAudit_(action, before, after, note) {
  const audit = getOrCreateSheet_(AUDIT_SHEET);
  ensureHeaders_(audit, AUDIT_HEADERS);
  const changedFields = before && after ? diffFields_(before, after).join(", ") : "";
  audit.appendRow([
    Utilities.getUuid(),
    new Date().toISOString(),
    getEditorEmail_(),
    action,
    (after && after.id) || (before && before.id) || "",
    (after && after.title) || (before && before.title) || "",
    changedFields,
    before ? JSON.stringify(before) : "",
    after ? JSON.stringify(after) : "",
    note || ""
  ]);
}

function diffFields_(before, after) {
  const fields = ["title", "department", "issues", "solution", "moreInfo", "attachments", "relatedKbs", "keywords", "escalation", "status"];
  return fields.filter((field) => JSON.stringify(before[field] || "") !== JSON.stringify(after[field] || ""));
}

function ensureRecordIds_(sheet) {
  const headers = getHeaders_(sheet);
  const idColumn = headers.indexOf("ID") + 1;
  const lastRow = sheet.getLastRow();
  if (!idColumn || lastRow <= 1) return;

  const idRange = sheet.getRange(2, idColumn, lastRow - 1, 1);
  const ids = idRange.getValues();
  let changed = false;
  const nextIds = ids.map((row) => {
    if (value_(row[0])) return [row[0]];
    changed = true;
    return [Utilities.getUuid()];
  });
  if (changed) idRange.setValues(nextIds);
}

function findRowById_(sheet, headers, id) {
  const idColumn = headers.indexOf("ID") + 1;
  if (!idColumn || !id || sheet.getLastRow() <= 1) return null;

  const ids = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) return index + 2;
  }
  return null;
}

function removeRowsById_(sheet, headers, id) {
  const idColumn = headers.indexOf("ID") + 1;
  if (!idColumn || !id || sheet.getLastRow() <= 1) return 0;

  const ids = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues();
  let removed = 0;
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (String(ids[index][0]) === String(id)) {
      sheet.deleteRow(index + 2);
      removed += 1;
    }
  }
  return removed;
}

function getOrCreateSheet_(name) {
  const spreadsheet = SpreadsheetApp.getActive();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders_(sheet, requiredHeaders) {
  const existingHeaders = getHeaders_(sheet);
  if (!existingHeaders.length) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return;
  }

  const missing = requiredHeaders.filter((header) => !existingHeaders.includes(header));
  if (missing.length) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  sheet.setFrozenRows(1);
}

function getHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((header) => value_(header)).filter(Boolean);
}

function setCell_(headers, row, header, value) {
  const index = headers.indexOf(header);
  if (index >= 0) row[index] = value_(value);
}

function attachmentCellValue_(cellValue, richTextValue, chipAttachmentValue, driveAttachmentCache) {
  const text = value_(cellValue);
  const linkedAttachments = linkedAttachmentLines_(richTextValue);
  const chipText = value_(chipAttachmentValue);
  if (/https?:\/\//i.test(text)) return text;
  if (!linkedAttachments.length && chipText) return chipText;
  if (!linkedAttachments.length) return driveAttachmentValue_(text, driveAttachmentCache) || text;

  if (chipText) return linkedAttachments.concat([chipText]).join("\n");
  return linkedAttachments.join("\n");
}

function linkedAttachmentLines_(richTextValue) {
  if (!richTextValue) return [];

  const lines = [];
  const fullText = richTextValue.getText ? value_(richTextValue.getText()) : "";
  const fullLink = richTextLink_(richTextValue);
  if (fullLink) lines.push(attachmentLine_(fullText, fullLink));

  const runs = richTextValue.getRuns ? richTextValue.getRuns() : [];
  runs.forEach((run) => {
    const link = richTextLink_(run);
    if (link) lines.push(attachmentLine_(run.getText ? value_(run.getText()) : "", link));
  });

  return Array.from(new Set(lines.filter(Boolean)));
}

function richTextLink_(richTextValue) {
  try {
    return value_(richTextValue.getLinkUrl && richTextValue.getLinkUrl());
  } catch (error) {
    return "";
  }
}

function attachmentLine_(label, url) {
  if (!url) return "";
  if (!label || label === url || /^https?:\/\//i.test(label)) return url;
  return `${label} - ${url}`;
}

function driveAttachmentValue_(text, cache) {
  const lines = value_(text)
    .split(/\r?\n|\s+\|\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const resolvedLines = lines.map((line) => driveAttachmentLine_(line, cache) || line);
  return resolvedLines.some((line) => /drive\.google\.com\/file\/d\/|data:image\//i.test(line))
    ? resolvedLines.join("\n")
    : "";
}

function driveAttachmentLine_(line, cache) {
  if (/https?:\/\/|data:image\//i.test(line)) return line;

  const filename = imageFilenameFromLine_(line);
  if (!filename) return "";

  const cacheKey = filename.toLowerCase();
  if (!(cacheKey in cache)) {
    cache[cacheKey] = driveFileUrlByName_(filename);
  }

  const url = cache[cacheKey];
  if (!url) return "";

  const label = line
    .replace(filename, "")
    .replace(/\s*[-–—:|]+\s*$/g, "")
    .trim();
  return attachmentLine_(label || filename, url);
}

function imageFilenameFromLine_(line) {
  return [line].concat(line.split(/\s+[-–—|:]\s+/).reverse())
    .map((candidate) => candidate.trim())
    .find((candidate) => /^[^<>:"/\\|?*]+\.(?:png|jpe?g|gif|webp|bmp|svg)$/i.test(candidate)) || "";
}

function driveFileUrlByName_(filename) {
  try {
    const files = DriveApp.getFilesByName(filename);
    if (!files.hasNext()) return "";
    const file = files.next();
    return driveFileDataUrl_(file) || driveFileViewUrl_(file);
  } catch (error) {
    return "";
  }
}

function driveFileDataUrl_(file) {
  try {
    if (file.getSize() > MAX_EMBEDDED_IMAGE_BYTES) return "";
    const blob = file.getBlob();
    const contentType = value_(blob.getContentType());
    if (!/^image\//i.test(contentType)) return "";
    return `data:${contentType};base64,${Utilities.base64Encode(blob.getBytes())}`;
  } catch (error) {
    return "";
  }
}

function driveFileViewUrl_(file) {
  return `https://drive.google.com/file/d/${file.getId()}/view`;
}

function attachmentChipValues_(sheet, headers, rowCount) {
  const attachmentColumn = headers.indexOf("Attachments / Images");
  if (attachmentColumn < 0 || rowCount <= 1) return [];

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const columnName = columnName_(attachmentColumn + 1);
    const range = `${quoteSheetName_(sheet.getName())}!${columnName}2:${columnName}${rowCount}`;
    const fields = "sheets(data(rowData(values(formattedValue,hyperlink,chipRuns))))";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.getId()}?includeGridData=true&ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}`;
    const response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) return [];

    const payload = JSON.parse(response.getContentText());
    const sheets = payload.sheets || [];
    const data = sheets[0] && sheets[0].data ? sheets[0].data : [];
    const rowData = data[0] && data[0].rowData ? data[0].rowData : [];

    return rowData.map((row) => {
      const values = row.values || [];
      const cell = values[0] || {};
      const label = value_(cell.formattedValue);
      const lines = [];

      if (cell.hyperlink) lines.push(attachmentLine_(label, cell.hyperlink));
      (cell.chipRuns || []).forEach((run) => {
        const chip = run.chip || {};
        const richLink = chip.richLinkProperties || {};
        if (richLink.uri) lines.push(attachmentLine_(label, richLink.uri));
      });

      return Array.from(new Set(lines.filter(Boolean))).join("\n");
    });
  } catch (error) {
    return [];
  }
}

function columnName_(columnNumber) {
  let name = "";
  let remaining = columnNumber;
  while (remaining > 0) {
    const offset = (remaining - 1) % 26;
    name = String.fromCharCode(65 + offset) + name;
    remaining = Math.floor((remaining - offset - 1) / 26);
  }
  return name;
}

function quoteSheetName_(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function splitSteps_(value) {
  return value_(value)
    .split(/\||\n+/)
    .map((item) => item.trim().replace(/^(?:\d+[\).]|[-*])\s*/, ""))
    .filter(Boolean);
}

function splitSynonyms_(value) {
  return value_(value)
    .split(/\||,|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEditorEmail_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "unknown";
}

function getViewerEmail_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "unknown";
}

function value_(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
