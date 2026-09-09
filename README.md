# Vibe-free certification

[![Test](https://github.com/sergkondr/vibe-free-certification/actions/workflows/test.yml/badge.svg)](https://github.com/sergkondr/vibe-free-certification/actions/workflows/test.yml)

A transparent GitHub Action that adds food-package-style certification labels to pull requests:

- `no vibecode added` when the author declares that they understand, tested, and can explain every change;
- `bio organic` when the author additionally declares that no generative AI produced code for the pull request.

This action does not claim to detect AI authorship from coding style. Such detection is not reliable. It verifies an explicit, machine-readable declaration and makes the certification rules visible to maintainers and contributors.

> [!IMPORTANT]
> This is a humorous project, and its code was written entirely by AI. A tool that certifies code as `bio organic` while failing its own certification is intentional meta-irony.
>
> The project comes with no warranty, and its author accepts no responsibility for what happens when you use it. This should not be taken as a comment on the author's character: by all available accounts, he is a responsible human being. See the [MIT License](LICENSE) for the considerably less amusing legal wording.

## Quick start

Copy [`examples/vibe-free.yml`](examples/vibe-free.yml) to `.github/workflows/vibe-free.yml` in your repository:

```yaml
name: Vibe-free certification

on:
  pull_request_target:
    types: [opened, reopened, synchronize, edited, ready_for_review, converted_to_draft]

permissions:
  issues: write
  pull-requests: write

jobs:
  certify:
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - uses: sergkondr/vibe-free-certification@v1
        with:
          github-token: ${{ github.token }}
```

Then add these lines to your pull request template:

```md
## Vibe-free declaration

- [ ] <!-- vibe-free:understood --> I understand every change in this pull request.
- [ ] <!-- vibe-free:tested --> I ran checks appropriate for this change and reviewed their results.
- [ ] <!-- vibe-free:explain --> I can explain the change and maintain it without relying on generated explanations.

### Code provenance — check exactly one

- [ ] <!-- vibe-free:no-ai --> No generative AI was used to produce code in this pull request.
- [ ] <!-- vibe-free:ai-reviewed --> Generative AI helped produce code, and I reviewed, understood, and tested every generated change.
```

The HTML comments are stable identifiers. You can translate or rewrite the visible text while keeping the markers unchanged.

The action creates its labels automatically. Every relevant pull request update first removes the existing certification labels and then reapplies only those supported by the current declaration. Draft pull requests are never certified.

## Certification results

| Result | `no vibecode added` | `bio organic` |
| --- | --- | --- |
| All core statements + `no-ai` | yes | yes |
| All core statements + `ai-reviewed` | yes | no |
| Missing or ambiguous declaration | no | no |
| Draft pull request | no | no |

The job summary explains why a pull request was not certified. By default, an unverified declaration does not fail the workflow. Set `fail-on-unverified: "true"` if you want to use the action as a required status check.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | yes | — | Token with permission to manage labels |
| `no-vibecode-label` | no | `no vibecode added` | Name of the process certification label |
| `organic-label` | no | `bio organic` | Name of the no-generative-AI label |
| `create-labels` | no | `true` | Create missing labels automatically |
| `fail-on-unverified` | no | `false` | Fail for drafts and incomplete declarations |

Outputs are `result`, `certified`, `organic`, and `reasons`.

## Security

The labels are informational self-attestations. **Never use them by themselves to approve or merge code, start a deployment or release, expose secrets, or grant any other privilege.** A pull request author can obtain them simply by checking the declaration boxes.

The default setup needs `issues: write` to create repository labels and `pull-requests: write` to apply them to a pull request. GitHub does not offer permissions scoped to one pull request. Do not pass a personal access token or additional secrets; use the job's short-lived `${{ github.token }}`.

For the smallest permission set, create both labels once, grant only `pull-requests: write`, and set `create-labels: "false"`. The action will then skip repository label management.

The workflow uses `pull_request_target` so it can update labels on pull requests from forks. The action reads only the event payload and calls the GitHub API. It does not check out, import, or execute code from the pull request.

Do not add a checkout of the pull request branch or execute contributor-controlled code in this job. Run builds and tests in a separate workflow triggered by `pull_request`.

The quick-start example uses `v1` for convenience. For production, replace it with the full commit SHA from the release. A tag can move if the action repository or maintainer account is compromised. Dependabot can keep pinned GitHub Actions references current.

Keep the explicit `timeout-minutes` limit to prevent a stalled API request from occupying a runner indefinitely. Each API request also has a 15-second timeout.

For this action's own repository, enable branch protection with required CODEOWNER review for `action.yml`, `src/`, and workflow files. Protect release tags or use GitHub immutable releases so a published version cannot silently change.

## Trust model

Certification is an attestation, not forensic proof. A contributor can make a false declaration, just as they can provide a misleading pull request description. Code review, tests, and repository policy remain the source of technical assurance. The labels make provenance expectations explicit and give honest contributors a consistent way to state them.

## Development

The action has no runtime dependencies. Run its policy and GitHub API integration tests with:

```sh
npm test
```

## License

[MIT](LICENSE)
