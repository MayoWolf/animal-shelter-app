import { google } from "googleapis";

export const handler = async (event) => {
  try {
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

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // Pull full table incl new columns
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:H",
    });

    const values = resp.data.values || [];
    if (values.length < 2) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dogs: [] }),
      };
    }

    const [header, ...data] = values;
    const idx = (h) => header.indexOf(h);

    const out = data.map((r) => ({
      timestamp: r[idx("Timestamp")] || "",
      name: r[idx("Name")] || "",
      photoUrl: r[idx("PhotoURL")] || "",
      temperament: r[idx("Temperament")] || "",
      size: r[idx("Size")] || "",
      weight: r[idx("Weight")] || "",
      lastWalked: r[idx("LastWalked")] || "", // NEW
      notes: r[idx("Notes")] || ""            // NEW
    }));

    // Optional: single dog lookup ?dog=Name
    const q = event.queryStringParameters?.dog;
    const body = q
      ? { dog: out.find(d => (d.name || "").toLowerCase() === q.toLowerCase()) || null }
      : { dogs: out };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
