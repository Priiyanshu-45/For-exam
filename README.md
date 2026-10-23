# UP PET Exam

A browser-based mock examination platform for Uttar Pradesh Preliminary Eligibility Test papers. It loads published papers from a JSON registry, supports browser-local paper imports, saves timed attempts in local storage, and provides scored results with question-by-question review.

## Architecture

- `src/types/` contains the shared exam, registry, attempt, and result types.
- `src/data/` handles registry discovery, resolved exam metadata, IndexedDB imports, and browser-local persistence.
- `src/engine/` contains validation, answer-key handling, scoring, attempt state, click behavior, and timer logic.
- `src/components/` contains shared navigation, dialogs, question palette, context blocks, and mathematical text rendering.
- `src/pages/` contains the exam library, instructions, exam-taking, history, management, and results screens.

## Setup and commands

Install dependencies with `npm install`, then run the development server:

```sh
npm run dev
```

Create a production build with:

```sh
npm run build
```

Run the automated Vitest suite with:

```sh
npm test
```

## Adding an exam

For a bundled paper, add a valid exam JSON file under `public/exams/` and add a published entry to `public/exams/registry.json`. The entry's `id` must match the paper's `examId`, and `dataPath` must point to the JSON file. Registry defaults provide duration and marking rules only when they are absent from both the paper and its registry entry.

Alternatively, open **Manage exams** and import an exam JSON file. The importer validates the paper and stores it in IndexedDB on the current browser. It does not upload files to the website. Use **Export JSON** to download an imported paper.

## Scoring policy

Verified answer keys are scored according to the paper, registry, or registry-default marking scheme, in that precedence order. A selected answer marked for review is scored normally. Unresolved, unreadable, disputed, incomplete, or missing answer keys are excluded from correct/incorrect scoring and contribute zero marks; maximum marks include only evaluable questions. Unanswered evaluable questions use the configured unattempted mark value.

Attempts, preferences, and imported papers are stored locally in the browser and are not synchronized between devices.
