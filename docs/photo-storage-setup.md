# Photo storage setup (Cloudflare R2)

Instructor photos are uploaded to file storage, not the database. The code is
built and deployed already; it stays switched off, and the profile form keeps
its "paste a photo link" box, until the five `STORAGE_*` settings below exist.
The moment they do, the form shows a proper **Choose a photo** button instead.

R2 is the recommended place: free for this size (10 GB of storage, 1M writes
and 10M reads a month, and no charge for downloads; see
<https://developers.cloudflare.com/r2/pricing>). At about 300 KB per resized
photo, 10 GB holds well over 30,000 photos. Anything that speaks the "S3"
protocol works the same way (Oracle Object Storage, Backblaze B2...), so
switching later is only a settings change.

## 1. Create the bucket (Cloudflare dashboard)

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
2. Name it `idistinguishr-photos`. Location: *Western Europe* (closest to your users).
3. Leave everything else as the default.

## 2. Make photos publicly readable at your own address

1. Open the bucket → **Settings** → **Public access** → **Custom Domains** → **Connect Domain**.
2. Enter `images.idistinguishr.com`. Cloudflare creates the DNS record for you
   (the domain is already on Cloudflare).
3. Wait until it shows **Active**. (Don't use the `r2.dev` address for the real
   site: it's rate-limited and meant for testing.)

## 3. Create an access key (so the website can upload)

1. R2 overview → **Manage API tokens** → **Create API token**.
2. Permission: **Object Read & Write**. Scope: **only the `idistinguishr-photos` bucket**.
3. Create it, then copy the **Access Key ID** and **Secret Access Key**.
   The secret is shown **once**. Do not paste either into chat.
4. On the R2 overview page copy your **Account ID**.

## 4. Give the site the five settings

Create a small file (outside the repo) like this and fill in the five values in
Notepad, the same way as the Resend key:

```yaml
stringData:
  STORAGE_ENDPOINT: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
  STORAGE_BUCKET: "idistinguishr-photos"
  STORAGE_ACCESS_KEY_ID: "<ACCESS KEY ID>"
  STORAGE_SECRET_ACCESS_KEY: "<SECRET ACCESS KEY>"
  STORAGE_PUBLIC_URL: "https://images.idistinguishr.com"
```

Then tell Claude it's saved; it applies it with a one-field-set patch and
restarts the site (the same safe method used for the Resend key), and deletes
the file.

## What it does, and its limits

- The browser shrinks every photo to at most 1200 px and re-encodes it as a
  JPEG before uploading (a few hundred KB; also strips hidden metadata such as
  GPS location).
- The server accepts only real JPEG, PNG or WebP files (checked from the file's
  first bytes, never its name), up to 2 MB, 10 uploads an hour per instructor.
- Once uploads are on, a profile photo must be one the instructor uploaded;
  arbitrary web addresses are refused. A photo link already saved before then
  keeps working until the instructor changes it.
- Replacing or removing a photo, or deleting the account, deletes the old file
  from storage (best-effort).
- If someone uploads a photo but leaves without pressing **Save changes**, the
  file stays in the bucket unused. It's harmless and tiny; an occasional clean-up
  of photos no profile points to is a possible later job.
- Photos have no text description yet (alt text), mentioned in the Accessibility
  statement. A "describe your photo" field would be a good follow-up.
