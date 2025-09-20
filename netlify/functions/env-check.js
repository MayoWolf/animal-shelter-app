export const handler = async () => {
  const dogsId = process.env.DOGS_SHEET_ID;
  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT;

  // Try to parse creds (without printing secrets)
  let parsedOK = false, parseErr = null, email = null;
  try {
    const obj = JSON.parse(credsRaw || "{}");
    parsedOK = !!obj.client_email && !!obj.private_key;
    email = obj.client_email || null;
  } catch (e) {
    parseErr = String(e);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      SITE_URL: process.env.URL || null,
      RUNTIME_CONFIRMED: true,
      DOGS_SHEET_ID_present: !!dogsId,
      DOGS_SHEET_ID_length: dogsId ? dogsId.length : 0,
      GOOGLE_SERVICE_ACCOUNT_present: !!credsRaw,
      GOOGLE_SERVICE_ACCOUNT_length: credsRaw ? credsRaw.length : 0,
      GOOGLE_SERVICE_ACCOUNT_parsed: parsedOK,
      GOOGLE_SERVICE_ACCOUNT_email: email,
      GOOGLE_SERVICE_ACCOUNT_parse_error: parseErr
    }, null, 2)
  };
};
