import { google } from 'googleapis';

export const handler = async () => {
  try {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const SHEET_ID = process.env.SHEET_ID;

    const jwt = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:Z",
    });

    const rows = resp.data.values || [];
    if (rows.length < 2) return ok({ dogs: [] });

    const dogs = rows.slice(1).map(r => ({
      timestamp: r[0] || '',
      name:      r[1] || '',
      difficulty:r[2] || '',
      size:      r[3] || '',
      weight:    r[4] || '',
      photo:     r[5] || '',
      notes:     r[6] || '',
    })).filter(d => d.name);

    return ok({ dogs });
  } catch (err) {
    console.error(err);
    return ok({ dogs: [] });
  }
};

function ok(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
