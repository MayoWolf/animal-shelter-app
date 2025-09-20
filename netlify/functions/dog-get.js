import { google } from "googleapis";
export const handler = async () => {
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
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // Read all rows from 'Dogs' sheet
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:E",
    });

    const values = resp.data.values || [];
    // Skip header
    const [, ...rows] = values;

    const dogs = rows.map(r => ({
      name: r[0] || "",
      photoUrl: r[1] || "",
      temperament: r[2] || "",
      size: r[3] || "",
      weight: r[4] || "",
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dogs }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error" };
  }
};
