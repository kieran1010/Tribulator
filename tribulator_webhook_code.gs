const CATEGORIES = [
  'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
  'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
  'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
  'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
  'Thoracics', 'Trauma', 'Vascular'
];

function extractPubmedId(url) {
  if (!url) return '';
  const match = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
  return match ? match[1] : '';
}

function doGet(e) {

  // Handle getConfig
  if (e && e.parameter && e.parameter.action === 'getConfig') {
    try {
      var configSs = SpreadsheetApp.openById('1nrWJa0cl5NBhM3pk0gvZk3-V0TTbh0YRZlarzrjxa_s');
      var configSheet = configSs.getSheets()[0];
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        apiKey:        configSheet.getRange(7, 2).getValue(),
        scriptUrl:     configSheet.getRange(8, 2).getValue(),
        webhookUrl:    configSheet.getRange(9, 2).getValue(),
        spreadsheetId: configSheet.getRange(10, 2).getValue()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Handle getPapers
  if (e && e.parameter && e.parameter.action === 'getPapers') {
    try {
      var ss = SpreadsheetApp.openById(e.parameter.spreadsheetId);
      var sheet = ss.getSheets()[0];
      var lastRow = sheet.getLastRow();
      if (lastRow <= 1) return ContentService.createTextOutput(JSON.stringify({ success: true, papers: [] })).setMimeType(ContentService.MimeType.JSON);
      var rows = sheet.getRange(2, 1, lastRow - 1, 8 + CATEGORIES.length).getValues();
      var papers = rows.filter(function(row) { return row[4]; }).map(function(row) {
      var cats = CATEGORIES.filter(function(cat, i) { return row[8 + i] === 'TRUE'; });
      return {
        subject: String(row[0] || '').substring(0, 100),
        oss: String(row[1] || '').substring(0, 200),
        fullSummary: String(row[2] || '').substring(0, 500),
        year: String(row[3] || ''),
        title: String(row[4] || '').substring(0, 200),
        reference: String(row[5] || '').substring(0, 150),
        url: String(row[6] || ''),
        dateEntered: String(row[7] || ''),
        categories: cats
      };
      }).sort(function(a, b) {
        function parseDate(str) {
          if (!str) return new Date(0);
          // Handle dd/mm/yyyy format
          var parts = str.split('/');
          if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
          }
          return new Date(str);
        }
        var dateA = parseDate(a.dateEntered);
        var dateB = parseDate(b.dateEntered);
        return dateB - dateA;
      });

    return { success: true, papers: papers };
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Handle export
  if (e && e.parameter && e.parameter.action === 'export') {
    try {
      Logger.log('Export action received');
      Logger.log('Payload param: ' + e.parameter.payload);
      var payload = JSON.parse(e.parameter.payload);
      Logger.log('Parsed payload title: ' + payload.title);
      var ss = SpreadsheetApp.openById(payload.spreadsheetId);
      var sheet = ss.getSheets()[0];
      Logger.log('Sheet: ' + sheet.getName());
      var categoryFlags = CATEGORIES.map(function(cat) {
        return payload.categoryFlags && payload.categoryFlags[cat] === 'TRUE' ? 'TRUE' : 'FALSE';
      });
      sheet.appendRow([
        payload.subject || '', payload.oss || '', payload.fullSummary || '',
        payload.year || '', payload.title || '', payload.reference || '',
        payload.url || '', payload.date || new Date().toLocaleDateString()
      ].concat(categoryFlags));
      SpreadsheetApp.flush();
      Logger.log('Export successful');
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) {
      Logger.log('Export error: ' + err.toString());
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Serve web app
  var prefillTitle = (e && e.parameter && e.parameter.title) ? e.parameter.title : '';
  var template = HtmlService.createTemplateFromFile('index');
  template.prefillTitle = prefillTitle;
  return template.evaluate()
    .setTitle('Tribulator')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No post data received');
    }

    const data = JSON.parse(e.postData.contents);

    if (data.action === 'pubmedFetch') {
      const response = UrlFetchApp.fetch(data.url);
      const mimeType = data.format === 'text'
        ? ContentService.MimeType.TEXT
        : ContentService.MimeType.JSON;
      return ContentService
        .createTextOutput(response.getContentText())
        .setMimeType(mimeType);
    }

    const spreadsheetId = data.spreadsheetId;
    if (!spreadsheetId) throw new Error('No spreadsheet ID provided');
    const ss = SpreadsheetApp.openById(spreadsheetId);

    if (data.action === 'importAll') {
      const sheet = ss.getSheets()[0];
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: true, bookmarks: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const rows = sheet.getRange(2, 1, lastRow - 1, 8 + CATEGORIES.length).getValues();
      const bookmarks = rows
        .filter(row => row[4])
        .map((row, i) => {
          const url = row[6] || '';
          const reference = row[5] || '';
          const pubmedId = extractPubmedId(url);
          const selectedCategories = CATEGORIES.filter((cat, ci) => row[8 + ci] === 'TRUE');
          return {
            id: pubmedId ? `pubmed-${pubmedId}` : `imported-${i}-${Date.now()}`,
            pubmedId: pubmedId || '',
            title: row[4] || '',
            journal: '',
            pubdate: row[3] || '',
            source: 'PubMed',
            keywords: [],
            mesh: [],
            quartile: null,
            impactFactor: null,
            bookmarked: true,
            url: url,
            storedReference: reference,
            dateAdded: row[7] || '',
            details: { journal: '', pubdate: row[3] || '' },
            aiSummary: {
              subject: row[0] || '',
              headline: row[1] || '',
              comprehensive: row[2] || '',
              category: selectedCategories,
            },
          };
        });
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, bookmarks: bookmarks }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'bulkExport') {
      const sheet = ss.getSheets()[0];
      if (sheet.getLastRow() === 0) {
        const headers = ['Subject', 'OSS', 'Full Summary', 'Year', 'Title', 'Reference', 'URL', 'Date Entered', ...CATEGORIES];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        SpreadsheetApp.flush();
      }
      const rows = data.rows || [];
      rows.forEach(row => {
        const categoryFlags = CATEGORIES.map(cat => row.categoryFlags?.[cat] === 'TRUE' ? 'TRUE' : 'FALSE');
        sheet.appendRow([
          row.subject || '', row.oss || '', row.fullSummary || '',
          row.year || '', row.title || '', row.reference || '',
          row.url || '', row.date || new Date().toLocaleDateString(),
          ...categoryFlags
        ]);
      });
      SpreadsheetApp.flush();
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, exported: rows.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle normal single export
    const sheet = ss.getSheets()[0];
    if (sheet.getLastRow() === 0) {
      const headers = ['Subject', 'OSS', 'Full Summary', 'Year', 'Title', 'Reference', 'URL', 'Date Entered', ...CATEGORIES];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      SpreadsheetApp.flush();
    }
    const categoryFlags = CATEGORIES.map(cat => data.categoryFlags?.[cat] === 'TRUE' ? 'TRUE' : 'FALSE');
    sheet.appendRow([
      data.subject || '', data.oss || '', data.fullSummary || '',
      data.year || '', data.title || '', data.reference || '',
      data.url || '', data.date || new Date().toLocaleDateString(),
      ...categoryFlags
    ]);
    SpreadsheetApp.flush();
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.log('Error: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function exportPaper(payload) {
  try {
    var ss = SpreadsheetApp.openById(payload.spreadsheetId);
    var sheet = ss.getSheets()[0];
    var categoryFlags = CATEGORIES.map(function(cat) {
      return payload.categoryFlags && payload.categoryFlags[cat] === 'TRUE' ? 'TRUE' : 'FALSE';
    });
    var row = [
      payload.subject || '', payload.oss || '', payload.fullSummary || '',
      payload.year || '', payload.title || '', payload.reference || '',
      payload.url || '', payload.date || new Date().toLocaleDateString()
    ].concat(categoryFlags);
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function getPapers(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheets()[0];
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, papers: [] };
    var rows = sheet.getRange(2, 1, lastRow - 1, 8 + CATEGORIES.length).getValues();
    var papers = rows.filter(function(row) { return row[4]; }).map(function(row) {
      var cats = CATEGORIES.filter(function(cat, i) { return row[8 + i] === 'TRUE'; });
      return {
        subject: String(row[0] || '').substring(0, 100),
        oss: String(row[1] || '').substring(0, 200),
        fullSummary: String(row[2] || '').substring(0, 500),
        year: String(row[3] || ''),
        title: String(row[4] || '').substring(0, 200),
        reference: String(row[5] || '').substring(0, 150),
        url: String(row[6] || ''),
        dateEntered: String(row[7] || ''),
        categories: cats
      };
    }).sort(function(a, b) {
      var dateA = new Date(a.dateEntered);
      var dateB = new Date(b.dateEntered);
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    });
    return { success: true, papers: papers };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}