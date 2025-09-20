import { google } from "googleapis";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const SHEET_ID =
      process.env.DOGS_SHEET_ID ||
      process.env.SHEET_ID_DOGS ||
      process.env.SHEET_ID;

    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!SHEET_ID || !credsJson) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing sheet id or GOOGLE_SERVICE_ACCOUNT" }),
      };
    }

    const {
      name,
      photoUrl = "",
      temperament = "",
      size = "",
      weight = "",
      lastWalked = "", // NEW
      notes = ""       // NEW
    } = JSON.parse(event.body || "{}");

    if (!name) {
      return { statusCode: 400, body: "Missing dog name" };
    }

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // Read all rows to upsert by Name
    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:H",
    });

    const rows = read.data.values || [];
    const header = rows[0] || [];

    // Build the new row in header order:
    // A: Timestamp | B: Name | C: PhotoURL | D: Temperament | E: Size | F: Weight | G: LastWalked | H: Notes
    const nowIso = new Date().toISOString();
    const newRow = [
      nowIso,
      name,
      photoUrl,
      temperament,
      size,
      String(weight),
      lastWalked, // NEW G
      notes       // NEW H
    ];

    // Find existing row for this Name (case-insensitive trim)
    let targetRowIndex = -1; // 0-based within rows array (incl header)
    const nameColIndex = header.indexOf("Name"); // should be 1
    if (nameColIndex !== -1 && rows.length > 1) {
      for (let i = 1; i < rows.length; i++) {
        const cell = (rows[i][nameColIndex] || "").toString().trim().toLowerCase();
        if (cell === name.trim().toLowerCase()) {
          targetRowIndex = i;
          break;
        }
      }
    }

    if (targetRowIndex === -1) {
      // Append
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "'Dogs'!A:H",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [newRow] },
      });
    } else {
      // Update the exact row
      const sheetRowNumber = targetRowIndex + 1; // convert to 1-based
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `'Dogs'!A${sheetRowNumber}:H${sheetRowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [newRow] },
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "Server error" };
  }
  
};
