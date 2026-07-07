# package.json dependency patch

Add this dependency to server/package.json if using Cloudflare R2 / S3-compatible upload:

```json
{
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0"
  }
}
```

Then run:

```bash
npm install
```

Render will also install it during deploy when package.json is updated.
