# syntax=docker/dockerfile:1.7
#
# A Powerhouse project's compound host as one container: builds the project
# from source, then runs `ph run <host> serve`, which supervises the members
# the host declares (for `cli`: the switchboard and the Connect that proxies
# it). Generic: nothing here names a project. README.md (next to this file)
# describes the configuration the container takes.
#
# Build context: the project root.
#   docker build -f hosts/cli/Dockerfile -t <project>-cli .
#   docker build -f hosts/cli/Dockerfile --build-arg PH_HOST=desktop ...
#
# Build arguments
#   PH_HOST        the host to build and run (hosts/<PH_HOST>/host.js); cli
#   NODE_VERSION   24, as the projects require
#   PNPM_VERSION   the pnpm the lockfile was made with (12.10.1, as the
#                  monorepo's CI)

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION=12.10.1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
# Hosts and `ph run` exist under the uniform-runners flag only
ENV FEATURE_UNIFORM_RUNNERS_ENABLED=1 \
    CI=true
WORKDIR /app

FROM base AS build
# Native addons in the dependency tree compile here
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Dependencies first, so a source change reuses this layer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG PH_HOST=cli
# `build` produces what each member serves and starts nothing: the
# switchboard member builds the project package (dist/, which it loads the
# project's models from), the Connect member the app (.ph/connect-build).
RUN node_modules/.bin/ph-cli run "${PH_HOST}" build

FROM base AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app /app
ARG PH_HOST=cli
# PH_USER_DATA_DIR moves what the switchboard keeps outside its database
# (its identity key pair, attachments, registry packages) onto the volume.
ENV NODE_ENV=production \
    PH_HOST=${PH_HOST} \
    PH_USER_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
# The ports the host's members listen on; publish the ones you serve.
EXPOSE 6540 7540
# tini forwards SIGTERM to ph-cli, which stops the members in order; the
# script checks the database setting first (README.md)
COPY --chmod=755 hosts/cli/docker-entrypoint.sh /usr/local/bin/ph-host
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/ph-host"]
