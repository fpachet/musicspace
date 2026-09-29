# Building and publishing releases

## Current distribution decision

Ship **0.1.0-alpha.5** as a local `.tgz`, installed as `@musicspace/engine`.
On 28 September 2026, a lookup against the public npm registry returned 404 for
this package name. `npm whoami` returned ENEEDAUTH on the release machine.
This does not establish ownership or availability of the `@musicspace` scope.
No registry publication has been performed.

Keep `private: true` while publisher identity and scope ownership are unresolved.
The manifest contains repository/issue links and an `alpha` publish tag for a future
public release. The archive can already be installed and shared independently.

## Build and verify an archive

Run these commands from a checkout of the full MusicSpace repository. Maintainer
scripts use the shared root engine sources and are not included in the archive.

```sh
npm ci
npm test
npm run check
npm run format:check
npm test --prefix packages/musicspace-engine
npm run smoke
npm pack ./packages/musicspace-engine --pack-destination packages/musicspace-engine
MUSICSPACE_TEST_ARCHIVE=packages/musicspace-engine/musicspace-engine-0.1.0-alpha.5.tgz node --test packages/musicspace-engine/test/install.test.cjs
```

The install test consumes the exact supplied archive offline in a temporary project.
It checks JavaScript ESM/CommonJS, TypeScript compilation and execution, both entry
points and required documentation. The compiler is a pinned root development
dependency; the distributed engine has no dependencies.

To check browser examples from the archive, extract it into a temporary directory
and run `test/browser.test.cjs` with `MUSICSPACE_TEST_PACKAGE_ROOT` set to the extracted
`package` directory. The test uses the repository's Playwright installation.
Record a SHA-256 checksum of the final archive when handing it off.

## Before an npm publication

1. Sign in to the intended npm account and verify its right to publish under the
   selected scope. Choose another name if needed and update imports and documentation.
2. Review integration feedback and release notes; select a new version if an already
   published version would be replaced.
3. Remove `private: true` once the name and publisher are established. Review
   `npm pack --dry-run` contents and rerun the archive checks above.
4. Publish the reviewed release explicitly with public access and the `alpha` tag;
   verify installation from the registry in a fresh project.

There is no automatic npm publishing workflow. See npm's documentation on
[package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
and [scoped publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
