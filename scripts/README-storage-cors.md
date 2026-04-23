# Firebase Storage CORS setup

The web app (fin-z.vercel.app) calls Firebase Storage directly from the
browser to upload / fetch KYC images + raw API responses. Firebase
Storage buckets start with an empty CORS policy, so the browser's
preflight fails with:

    Access to XMLHttpRequest at '…firebasestorage.googleapis.com/…'
    from origin 'https://fin-z.vercel.app' has been blocked by CORS policy

This is a **bucket-level configuration** — not a code fix. Apply the
rules in `storage-cors.json` once with `gsutil`.

## One-time setup

1. Install `gsutil`  — comes with the Google Cloud SDK.
2. Authenticate against the project owning the bucket:
       gcloud auth login
       gcloud config set project finz-2e9dc
3. Apply the CORS config:
       gsutil cors set scripts/storage-cors.json gs://finz-2e9dc.firebasestorage.app

Verify:

    gsutil cors get gs://finz-2e9dc.firebasestorage.app

You should see the JSON from `storage-cors.json` echoed back.

## Editing the allow-list

Update `scripts/storage-cors.json` and re-run the `gsutil cors set`
command. Add every deployment origin that talks to storage — staging,
prod, local dev — to the `origin` array.
