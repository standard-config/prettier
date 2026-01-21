> [!NOTE]
> This directory contains files used to validate formatting rules across cases and file types not covered by the source itself. Any discrepancy is going to get caught by `pnpm test:fixtures`.
>
> These contents can be safely ignored.

# Fixture

```json
{
    "name": "fixture",
    "files": [
        "fixtures.ts",
        "fixtures.d.ts"
    ],
    "exports": null,
    "scripts": {
        "test": "pnpm test:fixtures"
    }
}
```
