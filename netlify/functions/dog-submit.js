import { google } from "googleapis";
export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 🔑 Read env vars from Netlify
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT;
    const SHEET_ID   = process.env.DOGS_SHEET_ID;

    if (!credsJson || !SHEET_ID) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing env vars DOGS_SHEET_ID or GOOGLE_SERVICE_ACCOUNT" }),
      };
    }

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    const { name, photoUrl, temperament, size, weight } = JSON.parse(event.body || "{}");
    if (!name) {
      return { statusCode: 400, body: "Missing dog name" };
    }

    // Ensure header row exists in 'Dogs' sheet, then append
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A1:E1",
      valueInputOption: "RAW",
      requestBody: { values: [["Name", "Photo", "Temperament", "Size", "Weight (lb)"]] },
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:E",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          name,
          photoUrl || "",
          temperament || "",
          size || "",
          typeof weight === "number" ? weight : `${weight || ""}`
        ]],
      },
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error" };
  }
  const SHEET_ID = process.env.SHEET_ID_DOGS || process.env.DOGS_SHEET_ID;
if (!SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT) {
  return { statusCode: 500, body: JSON.stringify({ error: 'Missing env vars SHEET_ID_DOGS/DOGS_SHEET_ID or GOOGLE_SERVICE_ACCOUNT' }) };
}

};
