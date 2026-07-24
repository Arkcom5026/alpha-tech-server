# Next command

From `D:\alpha-tech\server`, copy this package into the repository, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\product-service-data-safety-gate-v1\scripts\01-capture-safety-evidence.ps1
```

Afterward execute the four SQL files against the same datasource in read-only mode and preserve their output under the generated evidence directory.

Do not run `prisma migrate dev --create-only` again until the evidence is reviewed.
