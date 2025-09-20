import { google } from 'googleapis';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, difficulty, size, weight, photo, notes, timestamp } = body;
    if (!name) return { statusCode: 400, body: 'Missing name' };

    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const SHEET_ID = process.env.SHEET_ID;

    const jwt = new google.auth.JWT(
      creds.client_email, null, creds.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const read = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'Dogs'!A:Z",
    });

    const rows = read.data.values || [];
    const header = rows[0] || [];
    const nameIdx = header.findIndex(h => String(h || '').toLowerCase().includes('dog name'));
    let updateRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][nameIdx] || '').toLowerCase() === name.toLowerCase()) {
        updateRowIndex = i; break;
      }
    }

    const row = [timestamp, name, difficulty, size, weight, photo, notes];

    if (updateRowIndex >= 1) {
      const range = `Dogs!A${updateRowIndex + 1}:G${updateRowIndex + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "'Dogs'!A:Z",
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Server error' };
  }
};
