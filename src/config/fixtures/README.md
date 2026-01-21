> [!NOTE]
> `src/config/fixtures` contains files used to validate formatting rules across cases and file types not covered by the source itself. Any discrepancy is going to get caught by `pnpm format:check`.
>
> The contents can be safely ignored.

# Fixture

```json
{
    "name": "fixtures",
    "files": [
        "fixture.ts",
        "fixture.d.ts"
    ],
    "exports": null,
    "scripts": {
        "test": "pnpm format:check"
    }
}
```
