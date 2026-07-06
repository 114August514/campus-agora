# Git LFS

Git LFS is reserved for large binary assets that are not useful in normal Git
diff review.

## Tracked Paths

`.gitattributes` tracks only these paths through LFS:

```text
design/lfs/**
assets/lfs/**
docs/assets/lfs/**
```

Keep the path scope narrow. Do not add global extension rules such as all PNG or
all PDF files.

## Allowed Content

Use LFS for:

- Large design source files.
- Large screenshots or videos.
- Large fonts or binary assets.
- Archives, models, or media that are too large for normal Git review.

## Forbidden Content

Do not put these in LFS:

- Source code.
- Markdown docs.
- SQL migrations.
- JSON contracts.
- Lockfiles.
- Small UI images.
- SVG icons.
- Secrets or private exports.

## Review Checklist

Before adding an LFS file:

1. Confirm the file belongs under an approved LFS path.
2. Confirm it is too large or too binary for normal Git review.
3. Confirm it contains no secrets or real student identity data.
4. Mention the reason in the PR description.

## Commands

Check tracked LFS patterns:

```bash
git lfs track
```

Check whether a file is stored through LFS:

```bash
git check-attr filter -- path/to/file
```
