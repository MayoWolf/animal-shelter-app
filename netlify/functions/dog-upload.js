// netlify/functions/dog-upload.js
import { google } from 'googleapis';
import { Readable } from 'node:stream';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { GOOGLE_SERVICE_ACCOUNT, DRIVE_FOLDER_ID } = process.env || {};
    if (!GOOGLE_SERVICE_ACCOUNT) {
      return { statusCode: 500, headers: hdr(), body: j({ error: 'Missing GOOGLE_SERVICE_ACCOUNT env var' }) };
    }

    // Parse JSON body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: hdr(), body: j({ error: 'Invalid JSON body' }) };
    }
    const { filename, mimeType, base64 } = body || {};
    if (!filename || !mimeType || !base64) {
      return { statusCode: 400, headers: hdr(), body: j({ error: 'Missing filename/mimeType/base64' }) };
    }

    // Parse service account JSON
    let creds;
    try {
      creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
    } catch {
      return { statusCode: 500, headers: hdr(), body: j({ error: 'GOOGLE_SERVICE_ACCOUNT not valid JSON' }) };
    }

    // Auth (Drive API must be enabled in this project)
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ['https://www.googleapis.com/auth/drive.file']
    );
    const drive = google.drive({ version: 'v3', auth });

    // Convert base64 → Buffer → Readable stream (Drive expects a stream-like body)
    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return { statusCode: 400, headers: hdr(), body: j({ error: 'base64 decode failed' }) };
    }
    const stream = Readable.from(buffer);

    const parents = DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : undefined;

    let createRes;
    try {
      createRes = await drive.files.create({
        requestBody: { name: filename, mimeType, parents },
        media: { mimeType, body: stream },
        fields: 'id, name, webViewLink, thumbnailLink',
      });
    } catch (e) {
      // Common issues: Drive API disabled, bad folder id, no permission on folder
      return {
        statusCode: 500,
        headers: hdr(),
        body: j({
          error: 'drive.files.create failed',
          details: e?.errors || e?.message || String(e),
        }),
      };
    }

    const fileId = createRes?.data?.id;
    if (!fileId) {
      return { statusCode: 500, headers: hdr(), body: j({ error: 'No fileId returned from Drive' }) };
    }

    // Make public (not fatal if this fails)
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
      });
    } catch {}

    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
      statusCode: 200,
      headers: hdr(),
      body: j({
        ok: true,
        fileId,
        viewUrl,
        webViewLink: createRes.data.webViewLink || null,
        thumbnailLink: createRes.data.thumbnailLink || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: hdr(),
      body: j({ error: 'Upload failed', details: err?.message || String(err) }),
    };
  }
};

function hdr() {
  return { 'Content-Type': 'application/json' };
}
function j(obj) {
  return JSON.stringify(obj);
}