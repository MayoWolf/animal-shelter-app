import { google } from "googleapis";

const ok = (body) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body, null, 2),
});

const bad = (code, msg) => ({
  statusCode: code,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify({ error: msg }),
});

export const handler = async () => {
  try {
    const SHEET_ID = process.env.DOGS_SHEET_ID;
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!SHEET_ID || !credsJson) {
      return bad(500, "Missing env vars DOGS_SHEET_ID or GOOGLE_SERVICE_ACCOUNT");
    }

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // Read first 6 columns (A..F) with header row
    const RANGE = "'Dogs'!A1:F";
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) return ok({ dogs: [] });

    const header = rows[0];
    const idx = {
      ts: header.indexOf("Timestamp"),
      name: header.indexOf("Name"),
      photo: header.indexOf("PhotoURL"),
      temp: header.indexOf("Temperament"),
      size: header.indexOf("Size"),
      weight: header.indexOf("Weight"),
    };

    const dogs = rows.slice(1).map((r) => ({
      timestamp: r[idx.ts] || "",
      name: r[idx.name] || "",
      photoUrl: r[idx.photo] || "",
      temperament: r[idx.temp] || "",
      size: r[idx.size] || "",
      weight: r[idx.weight] || "",
    }));

    return ok({ dogs });
  } catch (err) {
    console.error(err);
    return bad(500, "Server error");
  }
};