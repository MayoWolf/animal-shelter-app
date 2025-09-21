// netlify/functions/dog-upload.js
import { google } from 'googleapis';

export const handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { GOOGLE_SERVICE_ACCOUNT, DOGS_SHEET_ID, DRIVE_FOLDER_ID } = process.env || {};
    if (!GOOGLE_SERVICE_ACCOUNT) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing GOOGLE_SERVICE_ACCOUNT' }) };
    }
    // DOGS_SHEET_ID not required for upload, but we keep consistent naming

    // Expect JSON body: { filename, mimeType, base64 }
    const { filename, mimeType, base64 } = JSON.parse(event.body || '{}');
    if (!filename || !mimeType || !base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename/mimeType/base64' }) };
    }

    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT);

    // IMPORTANT: Drive API must be enabled in the same Google Cloud project.
    // Scope 'drive.file' lets us create files and manage the ones we create.
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/drive.file']
    );
    const drive = google.drive({ version: 'v3', auth });

    // Upload the file into the target folder (recommended), or root of svc account drive
    const parents = DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined;

    const fileBuffer = Buffer.from(base64, 'base64');

    const createRes = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType,
        parents,
      },
      media: {
        mimeType,
        body: Buffer.from(fileBuffer),
      },
      fields: 'id, webViewLink, thumbnailLink',
    });

    const fileId = createRes.data.id;

    // Make the file readable by anyone with the link (so the app can render it)
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    // Direct view link that works well for <img>
    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        fileId,
        viewUrl,
        webViewLink: createRes.data.webViewLink || null,
        thumbnailLink: createRes.data.thumbnailLink || null,
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Upload failed' }) };
  }
};
