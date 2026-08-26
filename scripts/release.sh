#!/bin/sh
set -eu

version="${npm_package_version:-$(node -p 'require("./package.json").version')}"
message="${RELEASE_MESSAGE:-chore: release v$version}"

git add -A
git commit -n -m "$message"
HUSKY=0 git push
