# Building and publishing releases

## Release identity

- Package: **@fpachet/musicspace-engine**
- Development candidate: **0.1.0-alpha.7**, unreleased; adds mutual gravity.
- Published version: **0.1.0-alpha.6**, 5 October 2026.
- npm publisher: **fpachet**, verified with `npm whoami` on 5 October 2026.
- Registry: `https://registry.npmjs.org/`, public access, `alpha` distribution tag.

The public registry's alpha tag resolves to this version. Its SHA-512 integrity
matches the tested archive, and a fresh registry installation passed the ESM
example, CommonJS and legacy-adapter checks. The root workbench remains private.

Released archive: `fpachet-musicspace-engine-0.1.0-alpha.6.tgz`.
SHA-256: `2f180d9ee2b48ae1503bbac20b2d829a6279f0707f10a3a8ab3e63f8b2348563`.
Keep this archive unchanged. The archive's documentation records its prepublication
preparation; repository documentation now records the completed release.

The earlier local alpha.5 archive used `@musicspace/engine`. Consumers upgrading
must change imports to `@fpachet/musicspace-engine` (including `/legacy-patch`).
The engine API and implementation were unchanged between alpha.5 and alpha.6.

## Build and verify the next candidate

The current candidate is alpha.7. The commands below build and verify that
candidate; they do not publish it. Keep the published alpha.6 archive unchanged.
For later releases, update the package version and archive filenames together.

From a checkout of the full MusicSpace repository:

```sh
npm ci
npm test
npm run check
npm run format:check
npm test --prefix packages/musicspace-engine
npm run smoke
npm pack ./packages/musicspace-engine --pack-destination packages/musicspace-engine
MUSICSPACE_TEST_ARCHIVE=packages/musicspace-engine/fpachet-musicspace-engine-0.1.0-alpha.7.tgz node --test packages/musicspace-engine/test/install.test.cjs
npm publish ./packages/musicspace-engine/fpachet-musicspace-engine-0.1.0-alpha.7.tgz --dry-run --access public --tag alpha --registry=https://registry.npmjs.org/
```

The install test consumes the supplied archive offline in a temporary project
using normal npm lifecycle behavior. It checks JavaScript ESM/CommonJS, strict
TypeScript compilation and execution, both entry points and required documentation.
The compiler is a pinned root development dependency; the engine has no runtime
dependencies. Maintainer build scripts read shared root sources; consumers receive
the built files and require no build step.

For the browser check, extract the archive into a temporary directory and run
`test/browser.test.cjs` with `MUSICSPACE_TEST_PACKAGE_ROOT` set to its extracted
`package` directory. The test uses the repository's Playwright installation.

The dry run validates the publication payload without uploading it. It does not
prove authentication or 2FA will succeed at publication time. Record a SHA-256
checksum of the final archive and publish those same tested bytes.

## Publish a new version when ready

1. Confirm `npm whoami --registry=https://registry.npmjs.org/` returns `fpachet`.
2. Check that the candidate version has not already been published. npm versions
   cannot be overwritten; increase the version and rebuild if necessary.
3. For an interactive publication, enable two-factor authentication on the npm
   account and complete the login/verification prompts in your browser or terminal.
4. From the repository root, publish the tested archive explicitly:

```sh
npm publish ./packages/musicspace-engine/fpachet-musicspace-engine-0.1.0-alpha.7.tgz --access public --tag alpha --registry=https://registry.npmjs.org/
```

This command makes the package public. The `alpha` tag marks the prerelease for
explicit installation. After publication, check the registry metadata:

```sh
npm view @fpachet/musicspace-engine@alpha version dist.integrity --registry=https://registry.npmjs.org/
```

Then install `@fpachet/musicspace-engine@alpha` in a fresh project and run
`node node_modules/@fpachet/musicspace-engine/examples/basic.mjs`. Update the
README, quick-start guide and release notes to record the actual publication.

There is no automatic npm publishing workflow. See npm's documentation on
[package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
and [scoped publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
