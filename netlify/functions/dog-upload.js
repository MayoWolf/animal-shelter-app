// netlify/functions/dog-upload.js
import { google } from 'googleapis';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { GOOGLE_SERVICE_ACCOUNT, DRIVE_FOLDER_ID } = process.env || {};
    if (!GOOGLE_SERVICE_ACCOUNT) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing GOOGLE_SERVICE_ACCOUNT env var' }) };
    }
    
    // Expect JSON body: { filename, mimeType, base64 }
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }
    const { filename, mimeType, base64 } = body;
    if (!filename || !mimeType || !base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename/mimeType/base64' }) };
    }

    let creds;
    try {
      creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT not valid JSON' }) };
    }

    // IMPORTANT: Drive API must be enabled for this project.
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/drive.file']
    );
    const drive = google.drive({ version: 'v3', auth });

    const parents = DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined;

    // Build media body from base64
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'base64 decode failed' }) };
    }

    // Create file
    let createRes;
    try {
      createRes = await drive.files.create({
        requestBody: { name: filename, mimeType, parents },
        media: { mimeType, body: buffer },
        fields: 'id, name, webViewLink, thumbnailLink',
      });
    } catch (e) {
      // Common reasons:
      // - Drive API not enabled
      // - DRIVE_FOLDER_ID invalid or no permission
      // - Mime type not allowed / quota issues
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'drive.files.create failed',
          details: e?.errors || e?.message || String(e),
        }),
      };
    }

    const fileId = createRes?.data?.id;
    if (!fileId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No fileId returned from Drive' }) };
    }

    // Make public (anyone with link)
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch (e) {
      // Not fatal for preview; still return the id/links we have
    }

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
    // FINAL CATCH — include message so we can see what’s up
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upload failed', details: err?.message || String(err) }),
    };
  }
};
