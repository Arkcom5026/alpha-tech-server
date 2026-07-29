# Rejected Runtime v4 Prisma Snapshot

This file preserves the rejected full-schema snapshot previously stored at:

`prisma/schema.runtime-v4.rejected.prisma`

It is intentionally stored outside the `prisma/` schema directory because `package.json` configures Prisma to load the entire `prisma` directory. Keeping a full duplicate schema there causes duplicate generator, model, and enum validation failures during `prisma generate`.

Original blob SHA: `1d4871c2c7ce473b62cddfd6042d74b2d2ae2121`

The original schema content is preserved in repository history and can be retrieved from that blob SHA or prior commits. This record documents why it was removed from the active Prisma schema boundary.
