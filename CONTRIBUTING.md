# Contributing to pixi-text-mesh-pro

## Development Setup

```bash
git clone https://github.com/ubberkid/pixi-text-mesh-pro.git
cd pixi-text-mesh-pro
npm install
```

## Running Tests

```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

Tests use [Vitest](https://vitest.dev/) with a Node environment. All 206 tests should pass before submitting a PR.

## Project Structure

```
src/
  core/       # TMPText, TMPTextStyle, TMPMaterial, TMPTextPipe
  font/       # TMPFont, TMPFontData, TMPFontLoader
  parser/     # RichTextParser, TagRegistry, tag handlers
  layout/     # TMPLayoutEngine, line/word metrics
  shader/     # TMPShader, GLSL programs
  sprites/    # InlineSpriteManager
  styles/     # TMPStyleSheet
  utils/      # autoSize, colorUtils, hashCode, unitParser
tests/
  core/       # Style tests
  font/       # Font loading/conversion tests
  parser/     # Rich text parsing tests
  layout/     # Layout engine tests
  styles/     # Style sheet tests
```

## PR Guidelines

- Describe what changed and why
- Add tests for new features or bug fixes
- Run `npm test` and ensure all tests pass
- Keep changes focused — one feature or fix per PR

## Code Style

- TypeScript strict mode
- Follow existing patterns in the codebase
- Use descriptive variable names
- Keep functions focused and small
