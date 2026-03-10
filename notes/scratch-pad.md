# Scratch Pad

Random notes to incorporate somewhere, sometime.

---

- **Node.js version upgrade needed.** App runs on Node v20, which EOLs ~April 2026.
  Recommend cycling to v22 (maintained until April 2027) or v24 (April 2028).
  Ref: https://nodejs.org/en/about/previous-releases

- **docker-compose.yml has obsolete `version` attribute.** Docker Compose warns:
  `the attribute 'version' is obsolete, it will be ignored`. Remove it to clean
  up the warning.

- **pnpm not included in project, assumed globally installed.** Had to install it
  separately and preface commands with `npx pnpm`. Instructions should document
  this prerequisite (or use corepack).

- **Root `pnpm install` doesn't install api deps.** Had to also `cd api && pnpm install`
  separately to get api dependencies. Workspace linking may be misconfigured — root
  install should handle all packages in a properly configured pnpm workspace.

- **`comply` CLI not installed warning.** Post-install warns:
  `comply CLI not installed - pre-commit hooks require it. Install with: pip install comply-cli`
  This is a Python dependency not mentioned in setup docs.

- **Build scripts ignored by pnpm.** Warning lists several packages with ignored
  build scripts (esbuild, leveldown, ssh2, etc.). Need to run `pnpm approve-builds`
  to whitelist them. Not documented.

- **E2E tests require Colima/Docker config not documented.** Testcontainers doesn't
  auto-detect Colima. Need two env vars:
  `DOCKER_HOST=unix:///Users/gjw/.colima/default/docker.sock`
  `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`
  Plus `~/.testcontainers.properties` with `docker.host=unix:///Users/gjw/.colima/default/docker.sock`.
  None of this is in the README or setup docs.

- **Building slides.** `./presentation/build.sh` renders all `.adoc` files to
  Reveal.js HTML. Requires `asciidoctor-revealjs` gem (installed via Homebrew Ruby
  at `/opt/homebrew/lib/ruby/gems/4.0.0/bin/asciidoctor-revealjs`). The build script
  falls back to that path if the command isn't on `$PATH`.

- **Elastic Beanstalk — worth investigating migration.** Not deprecated but widely
  considered legacy. Fargate is the natural upgrade path since a Dockerfile already
  exists. WebSocket support via ALB needs verification (sticky sessions, long-lived
  connections). Lower priority but worth scoping.
