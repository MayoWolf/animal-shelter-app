import { google } from "googleapis";

export const handler = async () => {
  try {
    const SHEET_ID = process.env.DOGS_SHEET_ID;
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT;

    if (!SHEET_ID || !credsJson) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok:false, reason:"Missing env vars at runtime", SHEET_ID_present: !!SHEET_ID, CREDS_present: !!credsJson })
      };
    }

    const creds = JSON.parse(credsJson);
    const jwt = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // Read header from Dogs
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A1:F"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok:true, header: resp.data.values?.[0] || null })
    };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
