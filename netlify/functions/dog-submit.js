import { google } from "googleapis";

const ok = (body) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const bad = (code, msg) => ({
  statusCode: code,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify({ error: msg }),
});

export const handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return bad(405, "Method Not Allowed");
  }

  try {
    const SHEET_ID = process.env.DOGS_SHEET_ID;
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!SHEET_ID || !credsJson) {
      return bad(500, "Missing env vars DOGS_SHEET_ID or GOOGLE_SERVICE_ACCOUNT");
    }

    const { name, photoUrl, temperament, size, weight } = JSON.parse(event.body || "{}");

    if (!name) return bad(400, "Missing 'name'");
    // normalize fields
    const ts = new Date().toISOString();
    const safePhoto = (photoUrl || "").trim();
    const safeTemp = (temperament || "").trim(); // Easy | Medium | Hard (free text OK)
    const safeSize = (size || "").trim();         // e.g., Small | Medium | Large
    const safeWeight = (weight ?? "").toString().trim();

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // We’ll always read/write the first 6 columns: A..F
    const RANGE = "'Dogs'!A1:F";

    // Optional: ensure header exists (no-op if already there)
    try {
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: RANGE,
      });
      if (!current.data.values || current.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: RANGE,
          valueInputOption: "RAW",
          requestBody: {
            values: [
              ["Timestamp", "Name", "PhotoURL", "Temperament", "Size", "Weight"],
            ],
          },
        });
      }
    } catch {
      // If GET fails (e.g., empty sheet), write header
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: RANGE,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            ["Timestamp", "Name", "PhotoURL", "Temperament", "Size", "Weight"],
          ],
        },
      });
    }

    // Append the row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RANGE, // explicit & valid A1 range
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[ts, name, safePhoto, safeTemp, safeSize, safeWeight]],
      },
    });

    return ok({ ok: true });
  } catch (err) {
    console.error(err);
    return bad(500, "Server error");
  }
};
